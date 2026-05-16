/**
 * GET /api/journey/pulse-confirm?t=<signed-token>
 *
 * Pulse survey confirmation page — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * The click tracker (/api/journey/click) redirects to this endpoint after
 * logging the click. This endpoint:
 *   1. Verifies HMAC signature on the `t` query token
 *   2. Logs the pulse survey score (same as /api/journey/pulse) if not
 *      already recorded (don't-downgrade idempotency)
 *   3. Returns a minimal HTML "Thank you" page with ZERO request-derived
 *      content — the page is identical on success and failure to prevent
 *      attacker-controlled UI on a Synthex-domain page.
 *
 * Backward compatibility: legacy URLs accepted only if
 * `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  PIXEL_AUDIENCES,
  verifyJourneyToken,
  type VerifyFailureReason,
} from '@/lib/journey/pixel-token';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

// Rendered identically on success AND signature failure — no request-derived
// content, no echoed user input. Attacker cannot manufacture a misleading page
// on our domain by crafting query params.
const THANK_YOU_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thanks for your feedback — Synthex</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08); max-width: 400px; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #0f172a; }
    p { margin: 0; font-size: 15px; color: #64748b; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Thanks for your feedback</h1>
    <p>Your response helps Synthex improve how we communicate your results.</p>
    <a href="https://synthex.social/dashboard">Go to your dashboard</a>
  </div>
</body>
</html>`;

function htmlResponse(): NextResponse {
  return new NextResponse(THANK_YOU_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function logVerifyFailure(reason: VerifyFailureReason): void {
  console.warn(`[journey/pulse-confirm] token-verify failed: ${reason}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('t');

  if (token) {
    const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulseConfirm);
    if (!result.ok) {
      logVerifyFailure(result.reason);
      return htmlResponse();
    }
    const { cid, mid, s } = result.payload;
    if (s !== undefined) await recordPulseConfirm(cid, mid, s);
    return htmlResponse();
  }

  if (process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED === 'true') {
    const clientId = searchParams.get('client_id');
    const momentId = searchParams.get('moment_id');
    const scoreRaw = searchParams.get('score');
    const score = scoreRaw !== null ? parseInt(scoreRaw, 10) : null;
    if (
      clientId &&
      momentId &&
      score !== null &&
      !isNaN(score) &&
      score >= 1 &&
      score <= 5
    ) {
      await recordPulseConfirm(clientId, momentId, score as 1 | 2 | 3 | 4 | 5);
      return htmlResponse();
    }
  }

  logVerifyFailure('missing-token');
  return htmlResponse();
}

async function recordPulseConfirm(
  clientId: string,
  momentId: string,
  score: 1 | 2 | 3 | 4 | 5
): Promise<void> {
  try {
    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from('client_journey_events')
      .select('metadata, engagement_outcome')
      .eq('id', momentId)
      .eq('client_id', clientId)
      .single();

    // Idempotency: only write if not already surveyed
    if (!existing || existing.engagement_outcome === 'surveyed') return;

    const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    await supabase
      .from('client_journey_events')
      .update({
        engagement_outcome: 'surveyed',
        metadata: {
          ...existingMeta,
          pulse_score: score,
          pulse_responded_at: new Date().toISOString(),
        },
      })
      .eq('id', momentId)
      .eq('client_id', clientId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey/pulse-confirm] Unexpected error:', msg);
  }
}
