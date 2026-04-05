/**
 * GET /api/journey/click
 *
 * Click-tracker + redirect endpoint.
 * Logs the 'clicked' engagement outcome for a journey event, then 302-redirects
 * to the destination URL.
 *
 * Query params:
 *   clientId  — organisation ID
 *   momentId  — journey event ID
 *   url       — destination URL (must be http:// or https://)
 *
 * Security: validates the destination URL protocol to prevent open-redirect
 * to javascript: or data: URIs. Falls back to /dashboard on invalid URLs.
 *
 * Uses 302 (not 301) — temporary redirect ensures every click hits the server
 * so engagement is always recorded, even for repeat clicks.
 *
 * @task SYN-677
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';
const FALLBACK_URL = `${APP_URL}/dashboard`;

/** Outcomes deeper than 'clicked' — do not downgrade if already at these levels */
const HIGHER_OUTCOMES = new Set(['surveyed', 'acted', 'replied']);

function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  const rawUrl = searchParams.get('url');

  // Validate destination URL before anything else
  const destUrl = rawUrl && isSafeUrl(rawUrl) ? rawUrl : FALLBACK_URL;

  if (!clientId || !momentId) {
    return NextResponse.redirect(destUrl, { status: 302 });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Cast required: client_journey_events not in generated Supabase types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawExisting } = await (supabase as any)
        .from('client_journey_events')
        .select('engagement_outcome')
        .eq('id', momentId)
        .eq('client_id', clientId)
        .maybeSingle();
      const existing = rawExisting as { engagement_outcome: string } | null;

      if (existing && !HIGHER_OUTCOMES.has(existing.engagement_outcome)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('client_journey_events')
          .update({ engagement_outcome: 'clicked' })
          .eq('id', momentId)
          .eq('client_id', clientId);
      }
    } catch {
      // Silent — redirect always happens
    }
  }

  return NextResponse.redirect(destUrl, { status: 302 });
}
