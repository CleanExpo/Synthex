/**
 * Supabase Edge Function: deliver-win-notifications
 *
 * Cron: 0 9 * * *  (daily 09:00 UTC = 19:00 AEDT)
 * Runs daily in the early evening AU time — checks prior day's post performance.
 *
 * Proxies to Next.js internal route which handles Prisma + business logic.
 * SYN-671
 */

const APP_URL    = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runDelivery(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/deliver-win-notifications`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );

  const body = await response.json();
  console.info('[deliver-win-notifications] Result:', JSON.stringify(body));

  if (!response.ok) {
    throw new Error(
      `[deliver-win-notifications] HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }
}

// Scheduled: daily 09:00 UTC = 19:00 AEDT
Deno.cron('deliver-win-notifications-daily', '0 9 * * *', runDelivery);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runDelivery();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deliver-win-notifications] Edge function error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
