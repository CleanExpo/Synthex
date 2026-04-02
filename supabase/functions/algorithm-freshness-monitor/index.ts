/**
 * algorithm-freshness-monitor — supabase/functions/algorithm-freshness-monitor/index.ts
 *
 * Supabase Edge Function (Deno) — fires on the 1st of each month at 06:00 UTC.
 * Proxies to the Next.js internal endpoint POST /api/internal/algorithm-freshness-monitor
 * which handles web search, AI analysis, Linear issue creation, and signal flagging.
 *
 * Two-layer cron pattern: Edge Function handles scheduling reliability;
 * Next.js handles Prisma, Linear API, and business logic.
 *
 * Cron: "0 6 1 * *"  (1st of each month at 06:00 UTC = 16:00 AEDT)
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-605
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('algorithm-freshness-monitor: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/algorithm-freshness-monitor`;

  console.info(`algorithm-freshness-monitor: triggering ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const body = await res.text();

    if (!res.ok) {
      console.error(
        `algorithm-freshness-monitor: endpoint returned ${res.status}`,
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

    console.info('algorithm-freshness-monitor: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('algorithm-freshness-monitor: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
