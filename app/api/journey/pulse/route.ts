/**
 * GET /api/journey/pulse?client_id=&moment_id=&score=
 *
 * Pulse survey tracking pixel — SYN-677
 *
 * Email clients do not support POST requests. Survey responses are captured
 * by embedding one link per score option as an <img> tag (1×1 transparent
 * pixel). When the email client loads the image, this route:
 *
 *   1. Validates query params (client_id, moment_id required; score 1-5)
 *   2. Updates `client_journey_events.engagement_outcome` → 'surveyed'
 *   3. Appends `pulse_score` + `pulse_responded_at` to the row's `metadata`
 *   4. Returns a 1×1 transparent GIF (no-cache headers)
 *
 * Non-fatal: DB errors are logged but the pixel is always returned so
 * the user's email client does not show a broken image.
 *
 * No authentication required — this route is called by email client image
 * loaders which do not send session cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get('client_id');
  const momentId = searchParams.get('moment_id');
  const scoreRaw = searchParams.get('score');

  // Always return the pixel regardless of errors
  const pixelResponse = () =>
    new NextResponse(PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

  if (!clientId || !momentId) {
    return pixelResponse();
  }

  const score = scoreRaw !== null ? parseInt(scoreRaw, 10) : null;
  if (score !== null && (isNaN(score) || score < 1 || score > 5)) {
    return pixelResponse();
  }

  try {
    const supabase = getAdminClient();

    // Fetch existing metadata to merge rather than overwrite
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
      ...(score !== null ? { pulse_score: score } : {}),
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

  return pixelResponse();
}
