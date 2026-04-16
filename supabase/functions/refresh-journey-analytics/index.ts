/**
 * refresh-journey-analytics — supabase/functions/refresh-journey-analytics/index.ts
 *
 * Supabase Edge Function (Deno) — fires every Sunday at 18:00 UTC (Monday 04:00 AEDT).
 * Proxies to the Next.js internal endpoint POST /api/internal/refresh-journey-analytics
 * which executes REFRESH MATERIALIZED VIEW CONCURRENTLY journey_analytics.
 *
 * Two-layer cron pattern: Edge Function handles scheduling reliability;
 * Next.js handles Prisma, Supabase admin client, and business logic.
 *
 * Cron: "0 18 * * 0"  (Sunday 18:00 UTC = Monday 04:00 AEDT)
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-678
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('refresh-journey-analytics: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/refresh-journey-analytics`;

  console.info(`refresh-journey-analytics: triggering ${endpoint}`);

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
        `refresh-journey-analytics: endpoint returned ${res.status}`,
        body.slice(0, 500)
      );
      return new Response(
        JSON.stringify({
          error: `Downstream returned ${res.status}`,
          detail: body.slice(0, 200),
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.info('refresh-journey-analytics: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('refresh-journey-analytics: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
