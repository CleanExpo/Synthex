/**
 * compute-content-profiles — supabase/functions/compute-content-profiles/index.ts
 *
 * Supabase Edge Function (Deno) — fires weekly (Sunday 22:00 AEST = 12:00 UTC).
 * Delegates to POST /api/internal/compute-content-profiles in Next.js where
 * the full profile computation runs (Prisma + Claude Haiku topic extraction).
 *
 * This two-layer pattern keeps Prisma + AI logic in Node while Supabase handles
 * reliable weekly cron scheduling.
 *
 * Cron: "0 12 * * 0"  (Sunday 12:00 UTC = 22:00 AEST)
 * Configure in Supabase dashboard → Edge Functions → Schedules.
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-631
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('compute-content-profiles: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/compute-content-profiles`;
  console.info(`compute-content-profiles: triggering ${endpoint}`);

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
        `compute-content-profiles: upstream error ${res.status}`,
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

    console.info('compute-content-profiles: success', body);
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('compute-content-profiles: fetch failed', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
