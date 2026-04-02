/**
 * Supabase Edge Function: compute-health-scores
 *
 * Cron: 0 19 * * 0  (Sunday 19:00 UTC = Monday 05:00 AEDT / 07:00 AEST)
 * Runs before AI Advisor brief generation so scores are fresh when briefs compile.
 *
 * Proxies to Next.js internal route which handles Prisma + business logic.
 * SYN-611
 */

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runComputation(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/compute-health-scores`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );
  const body = await response.json();
  console.info('[compute-health-scores] Result:', JSON.stringify(body));
}

// Scheduled: Sunday 19:00 UTC = Monday 05:00 AEDT
Deno.cron('compute-health-scores-weekly', '0 19 * * 0', runComputation);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runComputation();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[compute-health-scores] Edge function error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
