/**
 * deliver-thirty-day-checkin — Supabase Edge Function
 *
 * Cron: "0 11 * * *"  (daily at 11:00 UTC = 21:00 AEDT)
 *
 * Calls POST /api/internal/deliver-thirty-day-checkin with CRON_SECRET auth.
 * The Next.js route finds organisations in the 28–37 day window and sends
 * the 30-Day Check-In email to eligible clients.
 *
 * @task SYN-661
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://synthex.social';
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.error('deliver-thirty-day-checkin: CRON_SECRET not set');
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-thirty-day-checkin: starting run');

  const response = await fetch(
    `${appUrl}/api/internal/deliver-thirty-day-checkin`,
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
    console.error('deliver-thirty-day-checkin: route error', result);
    return new Response(
      JSON.stringify({ error: 'Route call failed', details: result }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.info('deliver-thirty-day-checkin: complete', result);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
