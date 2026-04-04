/**
 * monthly-geo-score-email — Supabase Edge Function
 *
 * Cron: "0 21 1 * *"  (1st of each month, 21:00 UTC = 08:00 AEDT)
 *
 * Proxies to POST /api/internal/deliver-monthly-geo-score-email
 * with CRON_SECRET Bearer auth. All business logic lives in Next.js.
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret, must match Next.js env
 *
 * @task SYN-658
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL = Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET  = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('monthly-geo-score-email: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/deliver-monthly-geo-score-email`;
  console.info(`monthly-geo-score-email: triggering ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await res.text();

    if (!res.ok) {
      console.error(`monthly-geo-score-email: endpoint returned ${res.status}`, body.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Downstream returned ${res.status}`, detail: body.slice(0, 200) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.info('monthly-geo-score-email: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('monthly-geo-score-email: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
