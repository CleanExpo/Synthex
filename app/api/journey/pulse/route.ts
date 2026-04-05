/**
 * GET /api/journey/pulse
 *
 * Tracking pixel endpoint — returns a 1×1 transparent GIF.
 * Email clients load this image on open, recording engagement.
 *
 * Query params:
 *   clientId  — organisation ID (client_journey_events.client_id)
 *   momentId  — journey event ID (client_journey_events.id)
 *   score     — optional pulse survey score (1–5), set when a score circle is clicked
 *
 * Always returns the pixel — errors are logged but never surface to the email client
 * (a broken image icon would degrade the email experience).
 *
 * @task SYN-677
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1×1 transparent GIF (44 bytes, hardcoded — no filesystem read required)
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const PIXEL_RESPONSE = () =>
  new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }
  return _supabase;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get('clientId');
  const momentId = searchParams.get('momentId');
  const scoreRaw = searchParams.get('score');

  // Always return pixel — validation errors are silent
  if (!clientId || !momentId) return PIXEL_RESPONSE();

  const score = scoreRaw ? parseInt(scoreRaw, 10) : null;
  if (score !== null && (isNaN(score) || score < 1 || score > 5)) {
    return PIXEL_RESPONSE();
  }

  const supabase = getSupabase();
  if (!supabase) return PIXEL_RESPONSE();

  try {
    // Fetch existing event to merge metadata rather than overwrite
    // Cast required: client_journey_events not in generated Supabase types
    const { data: rawExisting } = await (supabase as any)
      .from('client_journey_events')
      .select('id, metadata, engagement_outcome')
      .eq('id', momentId)
      .eq('client_id', clientId)
      .maybeSingle();
    const existing = rawExisting as {
      id: string;
      metadata: Record<string, unknown> | null;
      engagement_outcome: string;
    } | null;

    if (!existing) return PIXEL_RESPONSE();

    const existingMeta = existing.metadata ?? {};
    const newMeta: Record<string, unknown> = {
      ...existingMeta,
      pixel_loaded_at: new Date().toISOString(),
    };
    if (score !== null) newMeta.pulse_score = score;

    // Only advance outcome if not already at a deeper engagement level
    const HIGHER_OUTCOMES = new Set(['surveyed', 'acted', 'replied', 'clicked']);
    const shouldAdvance = !HIGHER_OUTCOMES.has(existing.engagement_outcome);

    await (supabase as any)
      .from('client_journey_events')
      .update({
        metadata: newMeta,
        ...(shouldAdvance ? { engagement_outcome: 'delivered' } : {}),
      })
      .eq('id', momentId)
      .eq('client_id', clientId);
  } catch {
    // Silent — pixel always returns
  }

  return PIXEL_RESPONSE();
}
