/**
 * Supabase Edge Function: generate-effect-reports
 *
 * Quarterly cron: 06:00 AEDT on first business day of Jan, Apr, Jul, Oct.
 * AEDT = UTC+11 in daylight saving, UTC+10 otherwise.
 * Conservative cron (fires daily on 1st-7th of Jan/Apr/Jul/Oct):
 *   0 20 1-7 1,4,7,10 *   (20:00 UTC = 06:00 AEDT)
 *
 * Proxies to Next.js internal route which handles Prisma + Supabase + email.
 * SYN-674
 */

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runGeneration(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/generate-effect-reports`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    }
  );

  const body = await response.json();
  console.info('[generate-effect-reports] Result:', JSON.stringify(body));

  if (!response.ok) {
    throw new Error(
      `[generate-effect-reports] HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }
}

// Quarterly cron: first business day of each quarter at 06:00 AEDT
Deno.cron(
  'generate-effect-reports-quarterly',
  '0 20 1-7 1,4,7,10 *',
  runGeneration
);

// HTTP handler for manual triggers and health checks
Deno.serve(async (_req: Request) => {
  try {
    await runGeneration();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-effect-reports] Edge function error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
