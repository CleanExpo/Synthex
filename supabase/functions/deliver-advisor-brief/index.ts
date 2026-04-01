/**
 * deliver-advisor-brief — supabase/functions/deliver-advisor-brief/index.ts
 *
 * Supabase Edge Function (Deno) — fires every Monday at 08:00 AEDT (21:00 UTC Sunday).
 * Proxies to the Next.js internal endpoint POST /api/internal/deliver-advisor-brief
 * which handles Prisma queries, Resend email delivery, and status updates.
 *
 * Runs 1 hour after generate-advisor-brief to allow a brief quality review window.
 * Two-layer cron pattern: Edge Function handles scheduling reliability;
 * Next.js handles Prisma, email, and business logic.
 *
 * Cron: "0 21 * * 0"  (Sunday 21:00 UTC = Monday 08:00 AEDT)
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret also set in Next.js env
 *
 * @task SYN-595
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('deliver-advisor-brief: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/internal/deliver-advisor-brief`;

  console.info(`deliver-advisor-brief: triggering ${endpoint}`);

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
        `deliver-advisor-brief: endpoint returned ${res.status}`,
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

    console.info('deliver-advisor-brief: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('deliver-advisor-brief: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
