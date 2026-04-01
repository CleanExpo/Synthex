/**
 * video-social-derivation — supabase/functions/video-social-derivation/index.ts
 *
 * Supabase Edge Function (Deno) — fires every 2 hours.
 * Calls the Next.js cron endpoint GET /api/cron/video-social-derivation
 * which finds recently published episodes without social posts and triggers
 * the full social cascade:
 *
 *   Published episode → ContentRepurposer → 6 platforms × 30-min stagger
 *
 * This two-step approach keeps Prisma + Node.js services in Next.js while
 * using Supabase Edge Functions as a reliable external cron trigger with
 * no Vercel invocation overhead.
 *
 * Cron schedule: "0 * /2 * * *"  (every 2 hours on the hour)
 * Configure in Supabase dashboard → Edge Functions → video-social-derivation → Schedule
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret matching CRON_SECRET in Next.js env
 *
 * @task SYN-572
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('video-social-derivation: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/cron/video-social-derivation`;

  console.info(`video-social-derivation: triggering ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await res.text();

    if (!res.ok) {
      console.error(
        `video-social-derivation: endpoint returned ${res.status}`,
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

    console.info('video-social-derivation: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('video-social-derivation: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
