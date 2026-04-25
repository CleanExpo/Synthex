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
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';

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

    const lead = await prisma.lead.create({
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
    });

    return NextResponse.json({ ok: true, lead }, { status: 200 });
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
