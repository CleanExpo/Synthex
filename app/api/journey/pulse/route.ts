/**
 * GET /api/journey/pulse?t=<signed-token>
 *
 * Pulse survey tracking pixel — SYN-677 (HMAC-signed since journey-hmac PR).
 *
 * Email clients do not support POST requests. Survey responses are captured
 * by embedding signed pixel URLs as <img> tags in the email body. When the
 * email client loads the image, this route:
 *
 *   1. Verifies HMAC signature on the `t` query token
 *   2. Updates `client_journey_events.engagement_outcome` → 'surveyed'
 *   3. Appends `pulse_score` + `pulse_responded_at` to the row's `metadata`
 *   4. Returns a 1×1 transparent GIF (no-cache headers)
 *
 * Non-fatal: DB errors are logged but the pixel is always returned so
 * the user's email client does not show a broken image.
 *
 * Signature failures always return the pixel — the failure mode is NOT
 * leaked. This blocks cross-tenant write probing while preserving the
 * email-pixel UX.
 *
 * No authentication required — pixel loads come from email client image
 * fetchers which do not send session cookies.
 *
 * Backward compatibility: legacy URLs (client_id+moment_id+score in query
 * string) are accepted ONLY if `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true` is set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

function logVerifyFailure(reason: VerifyFailureReason): void {
  console.warn(`[journey/pulse] token-verify failed: ${reason}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('t');

  if (token) {
    const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse);
    if (!result.ok) {
      logVerifyFailure(result.reason);
      return pixelResponse();
    }
    const { cid, mid, s } = result.payload;
    await recordPulse(cid, mid, s);
    return pixelResponse();
  }

  if (process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED === 'true') {
    const clientId = searchParams.get('client_id');
    const momentId = searchParams.get('moment_id');
    const scoreRaw = searchParams.get('score');
    if (clientId && momentId) {
      const score = scoreRaw !== null ? parseInt(scoreRaw, 10) : undefined;
      const validScore =
        score !== undefined && !isNaN(score) && score >= 1 && score <= 5
          ? (score as 1 | 2 | 3 | 4 | 5)
          : undefined;
      await recordPulse(clientId, momentId, validScore);
      return pixelResponse();
    }
  }

  logVerifyFailure('missing-token');
  return pixelResponse();
}

async function recordPulse(
  clientId: string,
  momentId: string,
  score: 1 | 2 | 3 | 4 | 5 | undefined
): Promise<void> {
  try {
    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from('client_journey_events')
      .select('metadata')
      .eq('id', momentId)
      .eq('client_id', clientId)
      .single();

    const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
    const updatedMeta: Record<string, unknown> = {
      ...existingMeta,
      pulse_responded_at: new Date().toISOString(),
      ...(score !== undefined ? { pulse_score: score } : {}),
    };

    const { error } = await supabase
      .from('client_journey_events')
      .update({
        engagement_outcome: 'surveyed',
        metadata: updatedMeta,
      })
      .eq('id', momentId)
      .eq('client_id', clientId);

    if (error) {
      console.error('[journey/pulse] DB update error:', error.message);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey/pulse] Unexpected error:', msg);
  }
}
