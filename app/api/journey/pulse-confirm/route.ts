/**
 * GET /api/journey/pulse-confirm?t=<signed-token>
 *
 * Pulse survey confirmation page — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * The click tracker (/api/journey/click) redirects to this endpoint after
 * logging the click. This endpoint verifies the HMAC signature on the `t`
 * query token and would record the pulse survey score.
 *
 * NOT PROVISIONED: `client_journey_events` has no Prisma model, so the score
 * cannot be recorded. Every request gets HTTP 501 with a minimal HTML page
 * that says so (no "thank you" for feedback that was dropped). The page has
 * ZERO request-derived content and is identical for valid and invalid tokens,
 * so signature validity is not leaked and no attacker-controlled UI appears
 * on a Synthex-domain page. Valid-but-dropped responses are logged.
 *
 * Backward compatibility: legacy URLs accepted only if
 * `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true`.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PIXEL_AUDIENCES,
  verifyJourneyToken,
  type VerifyFailureReason,
} from '@/lib/journey/pixel-token';

// Rendered identically for valid AND invalid tokens — no request-derived
// content, no echoed user input. Attacker cannot manufacture a misleading page
// on our domain by crafting query params.
const NOT_PROVISIONED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feedback not recorded — Synthex</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08); max-width: 400px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #0f172a; }
    p { margin: 0; font-size: 15px; color: #64748b; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>We couldn't record your feedback</h1>
    <p>Feedback collection isn't available yet, so your response was not saved.</p>
    <a href="https://synthex.social/dashboard">Go to your dashboard</a>
  </div>
</body>
</html>`;

function htmlResponse(): NextResponse {
  return new NextResponse(NOT_PROVISIONED_HTML, {
    status: 501,
    headers: {
      'X-Error': 'FEATURE_NOT_PROVISIONED',
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
    if (s !== undefined) logDroppedPulse(cid, mid);
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
      logDroppedPulse(clientId, momentId);
      return htmlResponse();
    }
  }

  logVerifyFailure('missing-token');
  return htmlResponse();
}

function logDroppedPulse(clientId: string, momentId: string): void {
  console.warn(
    `[journey/pulse-confirm] FEATURE_NOT_PROVISIONED: client_journey_events has no data model; pulse not recorded (client ${clientId}, moment ${momentId})`
  );
}
