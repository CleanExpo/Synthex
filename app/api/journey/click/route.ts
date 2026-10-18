/**
 * GET /api/journey/click?t=<signed-token>
 *
 * Journey click tracker — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * All CTA links in journey emails route through this endpoint so that
 * link-click engagement can be tracked per journey moment. On receipt:
 *
 *   1. Verifies HMAC signature on the `t` query token
 *   2. Would update `client_journey_events.engagement_outcome` → 'clicked'
 *   3. Returns HTTP 302 redirect to the signed destination URL
 *
 * NOT PROVISIONED: `client_journey_events` has no Prisma model, so the click
 * cannot be recorded. The redirect still proceeds (the client must reach
 * their destination) but the drop is explicit: it is logged as
 * FEATURE_NOT_PROVISIONED and the redirect carries an
 * `X-Journey-Tracking: FEATURE_NOT_PROVISIONED` header.
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
import {
  PIXEL_AUDIENCES,
  verifyJourneyToken,
  type VerifyFailureReason,
} from '@/lib/journey/pixel-token';

const JOURNEY_TRACKING_HEADER = 'X-Journey-Tracking';

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
    return untrackedRedirect(u, cid, mid);
  }

  // Legacy path — only enabled during cutover when flag is explicitly set
  if (process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED === 'true') {
    const clientId = searchParams.get('client_id');
    const momentId = searchParams.get('moment_id');
    const destUrl = searchParams.get('url');
    if (clientId && momentId && destUrl && isSafeUrl(destUrl)) {
      return untrackedRedirect(destUrl, clientId, momentId);
    }
  }

  logVerifyFailure('missing-token');
  return NextResponse.redirect(fallbackUrl(), { status: 302 });
}

/**
 * Redirect to the destination without recording the click: the
 * client_journey_events table is not provisioned. The drop is logged and
 * flagged on the response, never silent.
 */
function untrackedRedirect(
  url: string,
  clientId: string,
  momentId: string
): NextResponse {
  console.warn(
    `[journey/click] FEATURE_NOT_PROVISIONED: client_journey_events has no data model; click not recorded (client ${clientId}, moment ${momentId})`
  );
  const res = NextResponse.redirect(url, { status: 302 });
  res.headers.set(JOURNEY_TRACKING_HEADER, 'FEATURE_NOT_PROVISIONED');
  return res;
}
