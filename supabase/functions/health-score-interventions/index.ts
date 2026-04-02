/**
 * Supabase Edge Function: health-score-interventions
 *
 * Cron: 0 20 * * 0  (Sunday 20:00 UTC = Monday 06:00 AEDT)
 * Runs 1 hour after compute-health-scores (19:00 UTC) so fresh scores are available.
 *
 * Also chains from compute-health-scores via HTTP call for immediate execution.
 * SYN-615
 */

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runInterventions(): Promise<void> {
  const response = await fetch(`${APP_URL}/api/internal/run-interventions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });
  const body = await response.json();
  console.info('[health-score-interventions] Result:', JSON.stringify(body));
}

// Scheduled: Sunday 20:00 UTC = Monday 06:00 AEDT (1h after health score compute)
Deno.cron('health-score-interventions-nightly', '0 20 * * 0', runInterventions);

Deno.serve(async (_req: Request) => {
  try {
    await runInterventions();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[health-score-interventions] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
