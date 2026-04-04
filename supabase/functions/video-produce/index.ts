/**
 * video-produce — supabase/functions/video-produce/index.ts
 *
 * Supabase Edge Function (Deno) — fires twice weekly (Tue + Thu 6AM AEST).
 * Calls the Next.js cron endpoint GET /api/cron/video-production which runs
 * the full autonomous production pipeline:
 *
 *   Topic queue → Script → Capture → Quality Gate → YouTube Upload
 *
 * This two-step approach keeps Prisma + Playwright in Node (Next.js) while
 * using Supabase Edge Functions as a reliable external cron trigger with
 * no Vercel invocation overhead.
 *
 * Cron schedule: "0 20 * * 1,3"  (Tue + Thu 6AM AEST = 20:00 UTC Mon + Wed)
 * Configure in Supabase dashboard → Edge Functions → video-produce → Schedule
 *
 * Required env vars (set in Supabase dashboard):
 *   SYNTHEX_INTERNAL_URL  — e.g. https://synthex.social
 *   CRON_SECRET           — shared secret matching CRON_SECRET in Next.js env
 *
 * @task SYN-582
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const INTERNAL_URL =
  Deno.env.get('SYNTHEX_INTERNAL_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (_req: Request) => {
  if (!CRON_SECRET) {
    console.error('video-produce: CRON_SECRET env var missing');
    return new Response(JSON.stringify({ error: 'Configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${INTERNAL_URL}/api/cron/video-production`;

  console.info(`video-produce: triggering ${endpoint}`);

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
        `video-produce: endpoint returned ${res.status}`,
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

    console.info('video-produce: success', body.slice(0, 300));
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('video-produce: fetch error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
