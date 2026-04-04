/**
 * build-client-knowledge-graph — supabase/functions/build-client-knowledge-graph/index.ts
 *
 * Supabase Edge Function (Deno) — fires nightly at 02:00 UTC (12:00 AEDT).
 * Delegates to POST /api/internal/build-knowledge-graph in Next.js where
 * Prisma + AI + pgvector writes run (Node.js runtime).
 *
 * Two-layer cron pattern: Edge Function handles reliable nightly scheduling;
 * Next.js handles Prisma queries, OpenAI embeddings, and KG construction.
 *
 * Cron: "0 2 * * *"  (daily 02:00 UTC = 12:00 AEDT)
 * Configure in Supabase dashboard → Edge Functions → Schedules.
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-649
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('build-client-knowledge-graph: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/build-knowledge-graph`;
  console.info(`build-client-knowledge-graph: triggering ${endpoint}`);

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
        `build-client-knowledge-graph: upstream error ${res.status}`,
        body.slice(0, 500)
      );
      return new Response(
        JSON.stringify({ error: 'Upstream error', status: res.status, body: body.slice(0, 200) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.info('build-client-knowledge-graph: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('build-client-knowledge-graph: fetch failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
