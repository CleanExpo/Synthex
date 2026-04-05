/**
 * GET /api/journey/pulse-confirm
 *
 * Pulse survey confirmation endpoint.
 * Called when a client clicks a score circle in a journey email.
 * Writes engagement_outcome = 'surveyed' and returns an HTML thank-you page.
 *
 * Idempotency guard: if engagement_outcome is already 'surveyed' (or deeper),
 * the update is skipped — repeated clicks don't overwrite the first score.
 *
 * Query params:
 *   clientId  — organisation ID
 *   momentId  — journey event ID
 *   score     — pulse score 1–5
 *
 * @task SYN-677
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** Outcomes where a survey score has already been captured */
const ALREADY_SURVEYED = new Set(['surveyed', 'acted', 'replied']);

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

function buildThankYouPage(score: number | null): string {
  const message =
    score !== null && score >= 4
      ? "Thanks — we're glad this was useful."
      : score !== null && score <= 2
        ? "Thanks for the honest feedback. We'll keep improving."
        : "Thanks for sharing your feedback.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thanks — Synthex</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 40px 48px; text-align: center; max-width: 420px; }
    .logo { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 24px; }
    h1 { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #111827; }
    p { margin: 0 0 24px; font-size: 15px; color: #6b7280; line-height: 1.6; }
    a { display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Synthex</div>
    <h1>Feedback received</h1>
    <p>${message}</p>
    <a href="${APP_URL}/dashboard">Back to dashboard →</a>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get('clientId');
  const momentId = searchParams.get('momentId');
  const scoreRaw = searchParams.get('score');

  const score = scoreRaw ? parseInt(scoreRaw, 10) : null;
  const validScore = score !== null && !isNaN(score) && score >= 1 && score <= 5
    ? score
    : null;

  if (clientId && momentId) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Cast required: client_journey_events not in generated Supabase types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rawExisting } = await (supabase as any)
          .from('client_journey_events')
          .select('engagement_outcome, metadata')
          .eq('id', momentId)
          .eq('client_id', clientId)
          .maybeSingle();
        const existing = rawExisting as {
          engagement_outcome: string;
          metadata: Record<string, unknown> | null;
        } | null;

        if (existing && !ALREADY_SURVEYED.has(existing.engagement_outcome)) {
          const existingMeta = existing.metadata ?? {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('client_journey_events')
            .update({
              engagement_outcome: 'surveyed',
              metadata: {
                ...existingMeta,
                pulse_score: validScore,
                surveyed_at: new Date().toISOString(),
              },
            })
            .eq('id', momentId)
            .eq('client_id', clientId);
        }
      } catch {
        // Silent — page always renders
      }
    }
  }

  return new NextResponse(buildThankYouPage(validScore), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
