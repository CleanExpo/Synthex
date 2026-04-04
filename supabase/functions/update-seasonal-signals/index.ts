/**
 * update-seasonal-signals — supabase/functions/update-seasonal-signals/index.ts
 *
 * Supabase Edge Function (Deno) — fires weekly (Sunday 2 AM AEST).
 * Delegates to POST /api/internal/update-seasonal-signals in Next.js
 * where the full signal aggregation runs (Google Trends, ABS, school
 * calendars, public holidays).
 *
 * This two-layer pattern keeps Prisma + complex logic in Node while
 * Supabase handles reliable weekly cron scheduling.
 *
 * Cron: "0 16 * * 0"  (Sunday 16:00 UTC = 2:00 AM AEST Monday)
 * Configure in Supabase dashboard → Edge Functions → Schedules.
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-547
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('update-seasonal-signals: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/update-seasonal-signals`;
  console.info(`update-seasonal-signals: triggering ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await res.text();

    if (!res.ok) {
      console.error(
        `update-seasonal-signals: upstream error ${res.status}`,
        body
      );
      return new Response(
        JSON.stringify({ error: 'Upstream error', status: res.status, body }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.info('update-seasonal-signals: success', body);
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('update-seasonal-signals: fetch failed', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
