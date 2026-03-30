/**
 * process-publish-queue — supabase/functions/process-publish-queue/index.ts
 *
 * Supabase Edge Function (Deno) — fires every 15 minutes.
 * Calls the Next.js internal endpoint POST /api/internal/process-publish-queue
 * which runs the full publish queue orchestrator (Node.js / Prisma).
 *
 * This two-step approach keeps Prisma + encryption in Node (Next.js),
 * while using Supabase Edge Functions for the reliable 15-min cron schedule.
 *
 * Cron: "* /15 * * * *"  (every 15 minutes — configured in Supabase dashboard)
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-523
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('process-publish-queue: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/process-publish-queue`;

  console.info(`process-publish-queue: triggering ${endpoint}`);

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
        `process-publish-queue: endpoint returned ${res.status}`,
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

    console.info('process-publish-queue: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('process-publish-queue: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
