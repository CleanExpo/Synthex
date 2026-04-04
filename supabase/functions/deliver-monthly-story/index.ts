/**
 * deliver-monthly-story — Supabase Edge Function
 *
 * Cron: "0 10 * * *"  (daily at 10:00 UTC = 20:00 AEDT)
 *
 * Calls POST /api/internal/deliver-monthly-story with CRON_SECRET auth.
 * Checks each day whether any org's billing_anchor_date - 48h window is now open.
 *
 * @task SYN-553
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://synthex.social';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.error('deliver-monthly-story: CRON_SECRET not set');
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-monthly-story: starting run');

  const response = await fetch(`${appUrl}/api/internal/deliver-monthly-story`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({}),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('deliver-monthly-story: route error', result);
    return new Response(
      JSON.stringify({ error: 'Route call failed', details: result }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-monthly-story: complete', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
