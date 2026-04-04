/**
 * score-content-draft — Supabase Edge Function
 *
 * Cron: "0 14 * * 0"  (Sunday at 14:00 UTC = 00:00 AEDT Monday)
 * Runs after `compute-content-profiles` (Sunday 12:00 UTC) so profiles are fresh.
 *
 * Calls POST /api/internal/compute-content-scores with CRON_SECRET auth.
 * The Next.js route derives Content Scores from ContentPerformanceProfiles
 * and persists results to `content_score_history`.
 *
 * @task SYN-664
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://synthex.social';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.error('score-content-draft: CRON_SECRET not set');
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('score-content-draft: starting run');

  const response = await fetch(
    `${appUrl}/api/internal/compute-content-scores`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({}),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('score-content-draft: route error', result);
    return new Response(
      JSON.stringify({ error: 'Route call failed', details: result }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('score-content-draft: complete', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
