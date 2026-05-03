/**
 * POST /api/internal/sign-lead — Server-side signing shim for the public
 * `/benchmark` lead-capture form.
 *
 * The public form cannot hold `LEAD_CAPTURE_HMAC_SECRET` (it would ship to
 * every browser). This route accepts an unsigned payload from a same-origin
 * browser, signs it with the shared HMAC secret, and forwards it to the
 * already-shipped `POST /api/leads` endpoint.
 *
 * Trust boundary:
 *   - The route is **public** (no Supabase session required) because the
 *     `/benchmark` page itself is public — nobody is logged in when they
 *     submit the trial form.
 *   - It is constrained by an **Origin allowlist** (`CORS_ALLOWED_ORIGINS`
 *     plus `localhost`) and by the **same per-IP rate-limit bucket** that
 *     protects `/api/leads` (SYN-799).
 *   - It always pins the lead to the marketing-inbox organisation
 *     identified by `MARKETING_LEADS_ORG_ID`. Visitors cannot inject a
 *     different `organizationId` even if they tamper with the request body.
 *
 * The shim never echoes the HMAC secret, the signature, or the resolved
 * organisation id back to the client.
 *
 * @module app/api/internal/sign-lead/route
 * @task SYN-801
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { signLeadPayload } from '@/lib/auth/sign-lead-payload';

// ============================================================================
// Validation — public-facing surface, narrower than `/api/leads`
// ============================================================================

const RawPayloadSchema = z
  .object({
    email: z.string().email().max(254),
    businessName: z.string().min(1).max(200),
    phone: z.string().max(40).optional(),
  })
  .strict();

const BodySchema = z
  .object({
    contactMethod: z.literal('form_submission'),
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    occurredAt: z.string().datetime(),
    capturedFrom: z.string().min(1).max(200),
    rawPayload: RawPayloadSchema,
  })
  .strict();

// ============================================================================
// Origin allowlist
// ============================================================================

function parseAllowedOrigins(): readonly string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  // Always permit localhost dev, regardless of env config.
  const localDev = ['http://localhost:3008', 'http://127.0.0.1:3008'];

  return [...fromEnv, ...localDev];
}

function isAllowedOrigin(originHeader: string | null): boolean {
  if (!originHeader) return false;
  const allowed = parseAllowedOrigins();
  return allowed.includes(originHeader);
}

// ============================================================================
// Route
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (!isAllowedOrigin(origin)) {
      return NextResponse.json(
        { error: 'Origin not permitted' },
        { status: 403 }
      );
    }

    // Per-IP rate-limit. Reuses the same bucket namespace as `/api/leads` so
    // a single visitor cannot flood the shim to indirectly flood the
    // downstream endpoint.
    const ipKey = extractClientIp(request);
    const rate = await checkRateLimit(request, {
      namespace: 'leads',
      orgKey: 'public-shim',
      ipKey,
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

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = BodySchema.safeParse(parsed);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const orgId = process.env.MARKETING_LEADS_ORG_ID;
    if (!orgId) {
      logger.error(
        '[sign-lead] MARKETING_LEADS_ORG_ID not configured — cannot route public lead'
      );
      return NextResponse.json(
        { error: 'Lead capture temporarily unavailable' },
        { status: 503 }
      );
    }

    const enriched = {
      ...validation.data,
      organizationId: orgId,
    };

    let signed: { body: string; signature: string };
    try {
      signed = signLeadPayload(enriched);
    } catch (err) {
      logger.error('[sign-lead] Signing failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'Lead capture temporarily unavailable' },
        { status: 503 }
      );
    }

    // Forward server-side to the already-shipped, HMAC-protected endpoint.
    // Using the request's own origin keeps the call inside the same Vercel
    // deployment and avoids cross-region hops.
    const downstreamUrl = `${request.nextUrl.origin}/api/leads`;
    const downstream = await fetch(downstreamUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-synthex-signature': signed.signature,
      },
      body: signed.body,
    });

    // Mirror downstream status. Strip the body of any internal detail —
    // the public form only needs a pass/fail flag.
    if (downstream.ok) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Map known downstream failure codes; everything else surfaces as 502.
    if (downstream.status === 429) {
      const retryAfter = downstream.headers.get('Retry-After') ?? '60';
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': retryAfter } }
      );
    }
    if (downstream.status === 400) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    logger.error('[sign-lead] Downstream lead capture rejected', {
      status: downstream.status,
    });
    return NextResponse.json({ error: 'Lead capture failed' }, { status: 502 });
  } catch (err) {
    logger.error('[sign-lead] Unexpected failure', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Lead capture failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
