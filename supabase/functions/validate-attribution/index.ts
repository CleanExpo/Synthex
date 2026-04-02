/**
 * Supabase Edge Function: validate-attribution
 *
 * Cron: 0 2 * * *  (daily at 02:00 UTC)
 * Validates attribution model accuracy by checking what fraction of
 * recommended_actions records have populated attributionContext.
 *
 * CI gate for Sprint 6 ROI Dashboard deployment:
 *   AVG(output_metadata->>'accuracy_score') >= 0.80 over last 7 days.
 *
 * Proxies to Next.js internal route which handles Prisma + runner factory.
 * SYN-622 | SYN-627
 */

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runValidation(): Promise<void> {
  const response = await fetch(
    `${APP_URL}/api/internal/validate-attribution`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ days: 7 }),
    }
  );
  const body = await response.json();

  if (!response.ok) {
    console.error(
      '[validate-attribution] Internal route failed:',
      response.status,
      JSON.stringify(body).substring(0, 500)
    );
    return;
  }

  console.info('[validate-attribution] Result:', JSON.stringify(body));
}

// Scheduled: daily at 02:00 UTC (after nightly pipeline runs complete)
Deno.cron('validate-attribution-daily', '0 2 * * *', runValidation);

// HTTP handler for manual triggers
Deno.serve(async (_req: Request) => {
  try {
    await runValidation();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[validate-attribution] Edge function error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
