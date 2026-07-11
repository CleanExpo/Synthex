/**
 * Supabase Edge Function: churn-scorer
 *
 * Scheduled via pg_cron: daily-churn-score @ 0 2 * * *
 * Computes predictive churn risk scores for all active clients.
 * Proxies to Next.js internal route which handles Prisma + scoring logic.
 * SYN-618
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://synthex.social';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function runChurnScorer(
  trigger: string = 'cron',
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const response = await fetch(`${APP_URL}/api/internal/churn-scorer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ trigger, scope: 'all_organizations', ...extra }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`churn-scorer upstream error ${response.status}: ${text}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  console.log('[churn-scorer] Result:', JSON.stringify(body));
  return body;
}

// HTTP handler — invoked by pg_cron (daily) or manual triggers
Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        function: 'churn-scorer',
        schedule: '0 2 * * * (pg_cron)',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const trigger = (body.trigger as string) ?? 'manual';
    const result = await runChurnScorer(trigger, body);
    return new Response(
      JSON.stringify({ ok: true, triggered: trigger, ...result }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[churn-scorer] Handler error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
