/**
 * GET /api/journey/pulse?t=<signed-token>
 *
 * Pulse survey tracking pixel — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * Email clients do not support POST requests. Survey responses are captured
 * by embedding signed pixel URLs as <img> tags in the email body. When the
 * email client loads the image, this route verifies the HMAC signature on the
 * `t` query token and would record the score on `client_journey_events`.
 *
 * NOT PROVISIONED: `client_journey_events` has no Prisma model, so the score
 * cannot be recorded. Every request gets HTTP 501 with the 1×1 GIF body (no
 * broken image in the email) and `X-Error: FEATURE_NOT_PROVISIONED`. The
 * response is identical for valid and invalid tokens, so signature validity
 * is still not leaked. Valid-but-dropped responses are logged.
 *
 * No authentication required — pixel loads come from email client image
 * fetchers which do not send session cookies.
 *
 * Backward compatibility: legacy URLs (client_id+moment_id+score in query
 * string) are accepted ONLY if `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true` is set.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PIXEL_AUDIENCES,
  verifyJourneyToken,
  type VerifyFailureReason,
} from '@/lib/journey/pixel-token';

// 1×1 transparent GIF — 44 bytes, no file I/O
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function notProvisionedPixel(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 501,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Error': 'FEATURE_NOT_PROVISIONED',
    },
  });
}

function logVerifyFailure(reason: VerifyFailureReason): void {
  console.warn(`[journey/pulse] token-verify failed: ${reason}`);
}

function logDroppedPulse(clientId: string, momentId: string): void {
  console.warn(
    `[journey/pulse] FEATURE_NOT_PROVISIONED: client_journey_events has no data model; pulse not recorded (client ${clientId}, moment ${momentId})`
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('t');

  if (token) {
    const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse);
    if (!result.ok) {
      logVerifyFailure(result.reason);
      return notProvisionedPixel();
    }
    logDroppedPulse(result.payload.cid, result.payload.mid);
    return notProvisionedPixel();
  }

  if (process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED === 'true') {
    const clientId = searchParams.get('client_id');
    const momentId = searchParams.get('moment_id');
    if (clientId && momentId) {
      logDroppedPulse(clientId, momentId);
      return notProvisionedPixel();
    }
  }

  logVerifyFailure('missing-token');
  return notProvisionedPixel();
}
