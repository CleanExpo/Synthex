/**
 * GET /api/journey/click?t=<signed-token>
 *
 * Journey click tracker — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * All CTA links in journey emails route through this endpoint so that
 * link-click engagement can be tracked per journey moment. On receipt:
 *
 *   1. Verifies HMAC signature on the `t` query token
 *   2. Updates `client_journey_events.engagement_outcome` → 'clicked'
 *      (only if current outcome is 'delivered' — doesn't downgrade
 *      'surveyed' / 'acted')
 *   3. Returns HTTP 302 redirect to the signed destination URL
 *
 * Non-fatal: DB errors are logged but the redirect always proceeds so
 * the client reaches their intended destination.
 *
 * Signature failures (forged URL, expired token, wrong audience) always
 * return a 302 to the dashboard fallback — the failure mode is NOT leaked
 * to the caller. This blocks cross-tenant write probing while preserving
 * the email-link UX.
 *
 * No authentication required — link clicks come from email clients.
 *
 * Backward compatibility: legacy URLs (client_id+moment_id+url in query
 * string) are accepted ONLY if `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true` is set.
 * Default behaviour rejects unsigned URLs silently (302 to fallback).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  PIXEL_AUDIENCES,
  verifyJourneyToken,
  type VerifyFailureReason,
} from '@/lib/journey/pixel-token';

/** Outcomes that represent deeper engagement than 'clicked' — do not downgrade. */
const HIGHER_OUTCOMES = new Set(['surveyed', 'acted', 'replied']);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function fallbackUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    : 'https://synthex.social/dashboard';
}

function logVerifyFailure(reason: VerifyFailureReason): void {
  console.warn(`[journey/click] token-verify failed: ${reason}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('t');

  // Signed-token path
  if (token) {
    const result = verifyJourneyToken(token, PIXEL_AUDIENCES.click);
    if (!result.ok) {
      logVerifyFailure(result.reason);
      return NextResponse.redirect(fallbackUrl(), { status: 302 });
    }
    const { cid, mid, u } = result.payload;
    if (!u || !isSafeUrl(u)) {
      logVerifyFailure('payload-shape');
      return NextResponse.redirect(fallbackUrl(), { status: 302 });
    }
    await advanceClickIfLower(cid, mid);
    return NextResponse.redirect(u, { status: 302 });
  }

  // Legacy path — only enabled during cutover when flag is explicitly set
  if (process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED === 'true') {
    const clientId = searchParams.get('client_id');
    const momentId = searchParams.get('moment_id');
    const destUrl = searchParams.get('url');
    if (clientId && momentId && destUrl && isSafeUrl(destUrl)) {
      await advanceClickIfLower(clientId, momentId);
      return NextResponse.redirect(destUrl, { status: 302 });
    }
  }

  logVerifyFailure('missing-token');
  return NextResponse.redirect(fallbackUrl(), { status: 302 });
}

async function advanceClickIfLower(clientId: string, momentId: string): Promise<void> {
  try {
    const supabase = getAdminClient();
    const { data: existing } = await supabase
      .from('client_journey_events')
      .select('engagement_outcome')
      .eq('id', momentId)
      .eq('client_id', clientId)
      .single();

    const current = existing?.engagement_outcome as string | undefined;
    if (current && HIGHER_OUTCOMES.has(current)) return;

    const { error } = await supabase
      .from('client_journey_events')
      .update({ engagement_outcome: 'clicked' })
      .eq('id', momentId)
      .eq('client_id', clientId);

    if (error) {
      console.error('[journey/click] DB update error:', error.message);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey/click] Unexpected error:', msg);
  }
}
