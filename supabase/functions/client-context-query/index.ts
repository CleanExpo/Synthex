/**
 * client-context-query — supabase/functions/client-context-query/index.ts
 *
 * Ask Synthex Track A — SQL-level retrieval baseline (SYN-681)
 *
 * Handles conversational queries about a client's marketing performance.
 * Routes questions to the appropriate Claude model tier based on complexity,
 * queries structured data sources, and returns a grounded, source-cited answer.
 *
 * ModelRouter tiers:
 *   Haiku  — single-signal lookups  (≤3s target)
 *   Sonnet — multi-signal synthesis (≤8s target)
 *   Opus   — strategy questions     (≤15s target)
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-681
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!CRON_SECRET) {
    console.error('client-context-query: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward the request body to the Next.js route which has Prisma + AI access
  const endpoint = `${INTERNAL_URL}/api/ask-synthex`;

  console.info(`client-context-query: forwarding to ${endpoint}`);

  try {
    // Pass through the original Authorization header from the caller
    const authHeader = req.headers.get('Authorization') ?? '';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      body: JSON.stringify(body),
    });

    const responseBody = await res.text();

    if (!res.ok) {
      console.error(
        `client-context-query: endpoint returned ${res.status}`,
        responseBody.slice(0, 500)
      );
      return new Response(
        JSON.stringify({
          error: `Downstream returned ${res.status}`,
          detail: responseBody.slice(0, 200),
        }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('client-context-query: fetch failed', err);
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
