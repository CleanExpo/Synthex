/**
 * generate-monthly-story — Supabase Edge Function
 *
 * Cron: "0 1 1 * *"  (1st of each month at 01:00 UTC = 11:00 AEDT)
 *
 * Calls POST /api/internal/generate-monthly-story with CRON_SECRET auth.
 * The Next.js route handles all business logic and DB operations.
 *
 * @task SYN-553
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://synthex.social';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.error('generate-monthly-story: CRON_SECRET not set');
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('generate-monthly-story: starting run');

  const response = await fetch(
    `${appUrl}/api/internal/generate-monthly-story`,
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
    console.error('generate-monthly-story: route error', result);
    return new Response(
      JSON.stringify({ error: 'Route call failed', details: result }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('generate-monthly-story: complete', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
