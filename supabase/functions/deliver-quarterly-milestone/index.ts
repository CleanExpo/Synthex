/**
 * Supabase Edge Function: deliver-quarterly-milestone
 *
 * Cron: 0 12 * * 1  (weekly Monday 12:00 UTC = 22:00 AEDT)
 * Checks weekly for clients ready for their Quarterly Milestone Review.
 *
 * Proxies to Next.js internal route which handles Prisma + business logic.
 * Feature flag: QUARTERLY_REVIEW_ENABLED controls sends on the Next.js side.
 * SYN-662
 */

const APP_URL     = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runMilestone(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/deliver-quarterly-milestone`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );

  const body = await response.json();
  console.info('[deliver-quarterly-milestone] Result:', JSON.stringify(body));

  if (!response.ok) {
    throw new Error(
      `[deliver-quarterly-milestone] HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }
}

// Scheduled: weekly Monday 12:00 UTC = 22:00 AEDT
Deno.cron('deliver-quarterly-milestone-weekly', '0 12 * * 1', runMilestone);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runMilestone();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deliver-quarterly-milestone] Edge function error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
