/**
 * POST /api/leads — Public lead capture endpoint
 *
 * Ground-truth lead ingestion from form submissions, call-tracking bridges
 * (Twilio), GBP direction requests, and booking systems. No user session is
 * required — integrators sign the request body with HMAC-SHA256 using the
 * shared `LEAD_CAPTURE_HMAC_SECRET`.
 *
 * Security:
 *   - Missing / invalid `x-synthex-signature` header → 401
 *   - Invalid body → 400
 *   - Unknown organisation → 404
 *   - Over rate limit (per-org or per-IP) → 429 with Retry-After
 *
 * Header format: `x-synthex-signature: sha256=<hex-digest>`
 *
 * Rate limits: 60 req/min per org, 120 req/min per source IP. Backed by
 * Upstash Redis in production, in-memory fallback locally.
 *
 * @task SYN-794 (original), SYN-799 (rate-limit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import {
  recordLocalOutcome,
  type LocalOutcomeKind,
} from '@/lib/marketing-agency/outcomes/local-outcome-writer';

// ============================================================================
// Validation
// ============================================================================

const ContactMethodEnum = z.enum([
  'form_submission',
  'phone_call',
  'direction_request',
  'booking',
]);

const BodySchema = z.object({
  organizationId: z.string().min(1),
  contactMethod: ContactMethodEnum,
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  occurredAt: z.string().datetime(),
  capturedFrom: z.string().min(1),
  rawPayload: z.record(z.string(), z.unknown()),
  revenueEstimateAud: z.coerce.number().nonnegative().optional(),
});

const OUTCOME_KIND: Partial<
  Record<z.infer<typeof ContactMethodEnum>, LocalOutcomeKind>
> = {
  phone_call: 'call',
  booking: 'booking',
  direction_request: 'direction',
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// ============================================================================
// Signature verification
// ============================================================================

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.LEAD_CAPTURE_HMAC_SECRET;
  if (!secret) {
    logger.error('[leads] LEAD_CAPTURE_HMAC_SECRET not configured');
    return false;
  }
  if (!header) return false;

  // Accept both `sha256=<hex>` and raw hex forms.
  const provided = header.startsWith('sha256=') ? header.slice(7) : header;

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================================
// Route
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!verifySignature(rawBody, request.headers.get('x-synthex-signature'))) {
      return NextResponse.json(
        { error: 'Invalid or missing signature' },
        { status: 401 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = BodySchema.safeParse(parsedJson);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Rate limit — after HMAC passes, before we touch the DB. A signer with a
    // valid secret could otherwise flood the endpoint; HMAC guards identity,
    // not volume.
    const rate = await checkRateLimit(request, {
      namespace: 'leads',
      orgKey: body.organizationId,
      ipKey: extractClientIp(request),
    });
    if (!rate.ok) {
      const retryAfter = rate.retryAfterSeconds ?? 60;
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterSeconds: retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // Confirm the organisation exists — a forged but correctly-signed payload
    // pointing at a non-existent org should 404, not fall through to a DB FK
    // error.
    const org = await prisma.organization.findUnique({
      where: { id: body.organizationId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    const leadArgs = {
      data: {
        organizationId: body.organizationId,
        contactMethod: body.contactMethod,
        source: body.source,
        medium: body.medium,
        campaign: body.campaign,
        occurredAt: new Date(body.occurredAt),
        capturedFrom: body.capturedFrom,
        rawPayload: body.rawPayload as object,
        revenueEstimateAud: body.revenueEstimateAud,
      },
      select: { id: true, stage: true, occurredAt: true },
    };

    type Outcome =
      | { status: string; eventType: string }
      | { status: 'skipped'; reason: string }
      | null;
    let outcome: Outcome = null;
    let lead: Awaited<ReturnType<typeof prisma.lead.create<typeof leadArgs>>>;

    const kind = OUTCOME_KIND[body.contactMethod];
    // A supplied locationId is only trusted when it belongs to this organisation.
    let locationId: string | null = null;
    if (kind) {
      const supplied = nonEmptyString(body.rawPayload.locationId);
      const owned = await prisma.gBPLocation.findFirst({
        where: supplied
          ? { id: supplied, organizationId: body.organizationId }
          : { organizationId: body.organizationId, isPrimary: true },
        select: { id: true },
      });
      locationId = owned?.id ?? null;
      if (!locationId) {
        outcome = {
          status: 'skipped',
          reason: supplied
            ? 'location_not_in_organisation'
            : 'location_unresolved',
        };
        logger.warn('[leads] no usable location for outcome; lead kept', {
          organizationId: body.organizationId,
          reason: outcome.reason,
        });
      }
    }

    if (kind && locationId) {
      const resolvedLocationId = locationId;
      try {
        // Lead and outcome commit together: a failed outcome rolls the lead back
        // so the provider's retry is the only copy and the replay dedupes.
        const written = await prisma.$transaction(async tx => {
          const created = await tx.lead.create(leadArgs);
          const result = await recordLocalOutcome({
            organizationId: body.organizationId,
            locationId: resolvedLocationId,
            kind,
            dedupeKey:
              nonEmptyString(body.rawPayload.externalId) ??
              createHash('sha256').update(rawBody).digest('hex'),
            source: `leads:${body.capturedFrom}`,
            attribution: {
              source: body.source,
              medium: body.medium,
              campaign: body.campaign,
            },
            observedValue: body.revenueEstimateAud?.toString(),
            metadata: {
              occurredAt: body.occurredAt,
              capturedFrom: body.capturedFrom,
              leadId: created.id,
            },
            recordedAt: new Date(body.occurredAt),
            client: tx as unknown as NonNullable<
              Parameters<typeof recordLocalOutcome>[0]['client']
            >,
          });
          return { created, result };
        });
        lead = written.created;
        outcome = {
          status: written.result.status,
          eventType: written.result.eventType,
        };
      } catch (err) {
        logger.error('[leads] outcome write failed; lead rolled back', {
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { error: 'Outcome not recorded, retry', retryable: true },
          { status: 503, headers: { 'Retry-After': '30' } }
        );
      }
    } else {
      lead = await prisma.lead.create(leadArgs);
    }

    return NextResponse.json({ ok: true, lead, outcome }, { status: 200 });
  } catch (err) {
    logger.error('[leads] capture failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
