/**
 * POST /api/integrations/ga4/provision
 *
 * Kit K2 "measurement": under the client's onboarding grant ("Synthex may
 * create Analytics for me", analytics.edit), create — or reuse — the org's GA4
 * property, its web data stream and the lead key events, then store the
 * measurement ID on the org's GA4 integration record (GA4Property).
 *
 * Refuses (403 GA4_EDIT_CONSENT_REQUIRED) before any Google call unless the
 * org's googleanalytics PlatformConnection holds analytics.edit AND a recorded
 * grant. Idempotent: a re-run finds the existing property / stream / key
 * events and creates nothing. Concurrent runs for the same GA4 account are
 * serialised by a transaction-scoped Postgres advisory lock (the
 * lib/platform-connections/refresh-lock.ts pattern), so the second run waits,
 * re-lists and reuses what the first created instead of creating duplicates. A Google 403 is reported as missing consent or
 * missing account permission, never as success.
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
/** GA4 recommended lead events (kit K2 tracking plan). */
const DEFAULT_KEY_EVENTS = ['generate_lead', 'sign_up'];

const provisionSchema = z.object({
  accountId: z
    .string()
    .regex(
      /^(accounts\/)?\d+$/,
      'accountId must be the numeric GA4 account ID'
    ),
  displayName: z.string().trim().min(1).max(100),
  defaultUri: z.string().url().max(500),
  timeZone: z.string().min(1).max(64).default('Australia/Brisbane'),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('AUD'),
  keyEvents: z
    .array(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/))
    .min(1)
    .max(10)
    .default(DEFAULT_KEY_EVENTS),
});

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
    // Lock on the external resource (the GA4 account), not the tenant: two
    // overlapping runs against one account must not both pass the list step
    // and both create. Every list-then-create below runs under the lock, so a
    // run that waited re-lists and finds what the first run created.
    const lockKey = `ga4-provision:${input.accountId.replace(/^accounts\//, '')}`;
    const { property, dataStream, keyEvents, ga4Property } =
      await prisma.$transaction(
        async tx => {
          // Transaction-scoped: released at COMMIT/ROLLBACK on the one backend
          // this interactive transaction holds (safe under a transaction pooler).
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
          const property = await createProperty(deps, {
            accountId: input.accountId,
            displayName: input.displayName,
            timeZone: input.timeZone,
            currencyCode: input.currencyCode,
          });
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
    if (error instanceof Ga4AdminError) {
      logger.warn('GA4 provision refused by Google', {
        code: error.code,
        status: error.status,
      });
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
