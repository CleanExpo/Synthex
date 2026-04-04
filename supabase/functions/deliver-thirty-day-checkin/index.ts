/**
 * Supabase Edge Function: deliver-thirty-day-checkin
 *
 * Cron: 0 11 * * *  (daily 11:00 UTC = 21:00 AEDT)
 * Checks daily for clients in the 28-45 day window and delivers the 30-Day Check-In email.
 *
 * Proxies to Next.js internal route which handles Prisma + business logic.
 * Feature flag: THIRTY_DAY_CHECKIN_ENABLED controls sends on the Next.js side.
 * SYN-661
 */

const APP_URL     = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runCheckin(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/deliver-thirty-day-checkin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );

  const body = await response.json();
  console.info('[deliver-thirty-day-checkin] Result:', JSON.stringify(body));

  if (!response.ok) {
    throw new Error(
      `[deliver-thirty-day-checkin] HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }
}

// Scheduled: daily 11:00 UTC = 21:00 AEDT
Deno.cron('deliver-thirty-day-checkin-daily', '0 11 * * *', runCheckin);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runCheckin();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deliver-thirty-day-checkin] Edge function error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
