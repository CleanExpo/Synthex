/**
 * deliver-quarterly-milestone — Supabase Edge Function
 *
 * Cron: "0 12 * * 1"  (weekly on Monday at 12:00 UTC = 22:00 AEDT)
 *
 * Calls POST /api/internal/deliver-quarterly-milestone with CRON_SECRET auth.
 * The route checks quarterly review readiness via `quarterly_review_ready()` RPC
 * and sends the Quarterly Milestone Review email to eligible clients.
 *
 * Runs weekly rather than daily because:
 *   - Readiness data changes at weekly cadence (advisor briefs, health scores)
 *   - Quarterly delivery guard (85 days) prevents re-delivery
 *
 * @task SYN-662
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://synthex.social';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.error('deliver-quarterly-milestone: CRON_SECRET not set');
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-quarterly-milestone: starting run');

  const response = await fetch(
    `${appUrl}/api/internal/deliver-quarterly-milestone`,
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
    console.error('deliver-quarterly-milestone: route error', result);
    return new Response(
      JSON.stringify({ error: 'Route call failed', details: result }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-quarterly-milestone: complete', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
