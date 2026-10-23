/**
 * POST /api/integrations/ga4/provision
 *
 * Kit K2 "measurement": under the client's onboarding grant ("Synthex may
 * create Analytics for me", analytics.edit), create the org's GA4 property, its
 * web data stream and the lead key events, then store the measurement ID on
 * the org's GA4 integration record (GA4Property).
 *
 * Refuses (403 GA4_EDIT_CONSENT_REQUIRED) before any Google call unless the
 * org's googleanalytics PlatformConnection holds analytics.edit AND a recorded
 * grant, and only the member who granted it can use it. Synthex only ever
 * writes to a property it creates in this run: an org that already holds one
 * gets 409 GA4_ALREADY_PROVISIONED with no Google call, and a property with
 * the same name already in the account gets 409 GA4_PROPERTY_NAME_TAKEN (it is
 * never adopted). Concurrent runs for one org or one GA4 account are
 * serialised by transaction-scoped Postgres advisory locks (the
 * lib/platform-connections/refresh-lock.ts pattern). A Google 403 is reported
 * as missing consent or missing account permission, never as success.
 *
 * Bound to the signed statement (GA4_ADMIN_CONSENT_STATEMENT): the body may
 * only ask for an Australian time zone, AUD and the generate_lead / sign_up key
 * events (400 otherwise).
 *
 * The GA4 account must already exist: Google creates accounts only through
 * accounts.provisionAccountTicket plus the user accepting the Terms of Service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getOAuthAccessToken } from '@/lib/google/google-auth';
import { readGa4AdminGrant } from '@/lib/google/ga4-admin-consent';
import {
  createKeyEvents,
  createProperty,
  createWebDataStream,
  Ga4AdminError,
} from '@/lib/google/ga4-admin';
import { logger } from '@/lib/logger';

const GA4_PLATFORM = 'googleanalytics';
/**
 * Provisioning makes up to seven GA4 Admin round-trips while holding the lock,
 * and a concurrent run waits for the lock inside its own transaction, so the
 * interactive-transaction timeout covers both.
 */
const PROVISION_TX_TIMEOUT_MS = 60_000;
const PROVISION_TX_MAX_WAIT_MS = 10_000;
/**
 * GA4 recommended lead events (kit K2 tracking plan). These are also the ONLY
 * events GA4_ADMIN_CONSENT_STATEMENT lets Synthex mark as key events.
 */
const DEFAULT_KEY_EVENTS = ['generate_lead', 'sign_up'] as const;

/**
 * The request may only ask for what the client's signed statement covers:
 * one property in an Australian time zone priced in AUD, and the two lead
 * events. Anything broader needs a new statement, not a wider request body.
 */
const provisionSchema = z.object({
  accountId: z
    .string()
    .regex(
      /^(accounts\/)?\d+$/,
      'accountId must be the numeric GA4 account ID'
    ),
  displayName: z.string().trim().min(1).max(100),
  defaultUri: z.string().url().max(500),
  timeZone: z
    .string()
    .regex(
      /^Australia\/[A-Za-z_]+$/,
      'timeZone must be an Australian time zone (the consented scope)'
    )
    .default('Australia/Brisbane'),
  currencyCode: z.literal('AUD').default('AUD'),
  keyEvents: z
    .array(z.enum(DEFAULT_KEY_EVENTS))
    .min(1)
    .max(DEFAULT_KEY_EVENTS.length)
    .default([...DEFAULT_KEY_EVENTS]),
});

/** The org already holds more than one GA4 property; which to reuse is unclear. */
class AmbiguousOrgPropertyError extends Error {}
/** The org already holds its one GA4 property. */
class AlreadyProvisionedError extends Error {
  constructor(
    readonly existing: { propertyId: string; measurementId: string | null }
  ) {
    super('GA4 already provisioned for this organisation');
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        {
          error:
            'GA4 provisioning requires an active organization. Select or create one first.',
        },
        { status: 403 }
      );
    }

    const connection = await prisma.platformConnection.findFirst({
      where: { organizationId, platform: GA4_PLATFORM, isActive: true },
      select: { id: true, scope: true, metadata: true },
    });
    const grant = connection ? readGa4AdminGrant(connection) : null;
    if (!connection || !grant) {
      return NextResponse.json(
        {
          error: 'Analytics edit consent required',
          code: 'GA4_EDIT_CONSENT_REQUIRED',
          message:
            'This organisation has not granted "Synthex may create Analytics for me". Connect Google Analytics with that consent first (POST /api/integrations/ga4/connect with createAnalytics).',
        },
        { status: 403 }
      );
    }
    // The consent is per user: only the person who accepted the statement and
    // granted Google's scope can use it. Another member of the org cannot.
    if (grant.grantedByUserId !== userId) {
      return NextResponse.json(
        {
          error: 'Analytics edit consent required',
          code: 'GA4_EDIT_CONSENT_REQUIRED',
          message:
            '"Synthex may create Analytics for me" was granted by another member of this organisation. Only the person who granted it can set up Analytics with it.',
        },
        { status: 403 }
      );
    }

    let accessToken: string;
    try {
      accessToken = await getOAuthAccessToken(connection.id);
    } catch (err) {
      logger.error('GA4 provision token refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          error: 'Google Analytics needs reconnection',
          message:
            'The Google Analytics connection expired and could not be refreshed. Reconnect Google Analytics.',
        },
        { status: 401 }
      );
    }

    const input = parsed.data;
    const deps = { accessToken };
    // Lock on the external resource (the GA4 account) as well as the tenant:
    // two overlapping runs against one account must not both pass the list
    // step and both create. A run that waited re-lists, finds the property the
    // first run created, and is refused instead of creating a duplicate.
    const lockKey = `ga4-provision:${input.accountId.replace(/^accounts\//, '')}`;
    const orgLockKey = `ga4-provision-org:${organizationId}`;
    const { property, dataStream, keyEvents, ga4Property } =
      await prisma.$transaction(
        async tx => {
          // Transaction-scoped: released at COMMIT/ROLLBACK on the one backend
          // this interactive transaction holds (safe under a transaction pooler).
          // The org lock is always taken first, so two provision runs can never
          // hold the two locks in opposite orders.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgLockKey}))`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
          // The grant covers ONE property for the business. An org that already
          // holds a GA4 property is told so and nothing is written: Synthex
          // cannot vouch for the account or ownership of a property it did not
          // create in this run, so it never writes to one.
          const owned = await tx.gA4Property.findMany({
            where: { organizationId },
            select: { propertyId: true, measurementId: true },
          });
          if (owned.length > 1) throw new AmbiguousOrgPropertyError();
          if (owned.length === 1) throw new AlreadyProvisionedError(owned[0]);
          const property = await createProperty(deps, {
            accountId: input.accountId,
            displayName: input.displayName,
            timeZone: input.timeZone,
            currencyCode: input.currencyCode,
          });
          // createProperty never adopts an existing property (a same name is
          // PROPERTY_NAME_TAKEN), so everything below writes only to the
          // property this run just created.
          const dataStream = await createWebDataStream(deps, {
            propertyId: property.propertyId,
            defaultUri: input.defaultUri,
          });
          const keyEvents = await createKeyEvents(deps, {
            propertyId: property.propertyId,
            eventNames: input.keyEvents,
          });

          const ga4Property = await tx.gA4Property.upsert({
            where: {
              organizationId_propertyId: {
                organizationId,
                propertyId: property.propertyId,
              },
            },
            update: {
              measurementId: dataStream.measurementId,
              displayName: property.displayName,
              syncStatus: 'active',
            },
            create: {
              organizationId,
              propertyId: property.propertyId,
              measurementId: dataStream.measurementId,
              displayName: property.displayName,
              syncStatus: 'active',
            },
          });
          return { property, dataStream, keyEvents, ga4Property };
        },
        { timeout: PROVISION_TX_TIMEOUT_MS, maxWait: PROVISION_TX_MAX_WAIT_MS }
      );

    logger.info('GA4 provisioned for organisation', {
      organizationId,
      propertyId: property.propertyId,
      propertyCreated: property.created,
      streamCreated: dataStream.created,
      keyEventsCreated: keyEvents.created,
      grantedByUserId: grant.grantedByUserId,
    });

    return NextResponse.json(
      { property, dataStream, keyEvents, ga4Property },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AmbiguousOrgPropertyError) {
      return NextResponse.json(
        {
          error: 'Organisation already has more than one GA4 property',
          code: 'GA4_PROPERTY_AMBIGUOUS',
          message:
            'This organisation is linked to more than one GA4 property, so Synthex will not create or choose one. Remove the extra link first.',
        },
        { status: 409 }
      );
    }
    if (error instanceof AlreadyProvisionedError) {
      return NextResponse.json(
        {
          error: 'Google Analytics is already set up for this organisation',
          code: 'GA4_ALREADY_PROVISIONED',
          message:
            'This organisation already has its GA4 property. Synthex creates one property per business and does not change an existing one.',
          propertyId: error.existing.propertyId,
          measurementId: error.existing.measurementId,
        },
        { status: 409 }
      );
    }
    if (error instanceof Ga4AdminError) {
      logger.warn('GA4 provision refused by Google', {
        code: error.code,
        status: error.status,
      });
      if (error.code === 'PROPERTY_NAME_TAKEN') {
        return NextResponse.json(
          {
            error: 'A GA4 property with this name already exists',
            code: 'GA4_PROPERTY_NAME_TAKEN',
            message: error.message,
          },
          { status: 409 }
        );
      }
      if (error.code === 'NEEDS_EDIT_CONSENT') {
        return NextResponse.json(
          {
            error: 'Analytics edit consent required',
            code: 'GA4_EDIT_CONSENT_REQUIRED',
            message: error.message,
          },
          { status: 403 }
        );
      }
      if (error.code === 'PERMISSION_DENIED') {
        return NextResponse.json(
          {
            error: 'Google Analytics permission denied',
            code: error.code,
            message: error.message,
          },
          { status: 403 }
        );
      }
      if (error.code === 'STREAM_EXISTS') {
        return NextResponse.json(
          {
            error: 'GA4 property already has a web data stream',
            code: 'GA4_STREAM_EXISTS',
            message: error.message,
          },
          { status: 409 }
        );
      }
      if (error.code === 'UNAUTHENTICATED') {
        return NextResponse.json(
          {
            error: 'Google Analytics needs reconnection',
            code: error.code,
            message: error.message,
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          error: 'GA4 provisioning failed',
          code: error.code,
          message: error.message,
        },
        { status: 502 }
      );
    }
    logger.error('GA4 provision error:', error);
    return NextResponse.json(
      { error: 'Failed to provision Google Analytics' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
