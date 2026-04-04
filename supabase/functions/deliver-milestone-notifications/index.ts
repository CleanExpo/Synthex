/**
 * Supabase Edge Function: deliver-milestone-notifications
 *
 * Cron: 0 22 * * *  (daily 22:00 UTC = 08:00 AEDT)
 * Processes pending milestone_events and sends notification emails.
 *
 * Flow:
 *   1. Seeds anniversary_1yr events for today's anniversaries (via RPC)
 *   2. Fetches all milestone_events WHERE email_sent_at IS NULL
 *   3. Sends milestone notification email via Resend
 *   4. Sets email_sent_at on each delivered row
 *
 * Proxies to Next.js internal route which handles Prisma + business logic.
 * Feature flag: MILESTONE_NOTIFICATIONS_ENABLED controls sends on Next.js side.
 * SYN-675
 */

const APP_URL     = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runMilestones(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/deliver-milestone-notifications`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );

  const body = await response.json();
  console.info('[deliver-milestone-notifications] Result:', JSON.stringify(body));

  if (!response.ok) {
    throw new Error(
      `[deliver-milestone-notifications] HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }
}

// Scheduled: daily 22:00 UTC = 08:00 AEDT
Deno.cron('deliver-milestone-notifications-daily', '0 22 * * *', runMilestones);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runMilestones();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deliver-milestone-notifications] Edge function error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
