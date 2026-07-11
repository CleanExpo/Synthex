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
// Inbound manual-trigger secret (mirrors lib/auth/cron-auth.ts CRON_SECRET_<ROUTE>);
// per-function first, shared fallback. The Deno.cron schedule below does NOT go
// through the HTTP handler, so this gate never affects the real scheduled run.
const INBOUND_SECRET =
  Deno.env.get('CRON_SECRET_HEALTH_SCORE_INTERVENTIONS') ?? CRON_SECRET;
// Log-only until EDGE_AUTH_ENFORCE=true (F2 rollout). Log-only never blocks a caller.
const ENFORCE_INBOUND =
  (Deno.env.get('EDGE_AUTH_ENFORCE') ?? 'false') === 'true';

/** Constant-time compare (upgrade over cron-auth's === ). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gate the open HTTP trigger. Returns a 401 Response to block, or null to allow. */
function checkInboundSecret(req: Request): Response | null {
  const provided = (req.headers.get('authorization') ?? '').replace(
    /^Bearer\s+/i,
    ''
  );
  if (INBOUND_SECRET.length > 0 && timingSafeEqual(provided, INBOUND_SECRET)) {
    return null;
  }
  if (!ENFORCE_INBOUND) {
    console.warn(
      '[health-score-interventions] inbound secret missing/invalid (log-only; allowing). Set EDGE_AUTH_ENFORCE=true to block.'
    );
    return null;
  }
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

// HTTP handler (the Deno.cron schedule above bypasses this path). Gated by an
// inbound secret; log-only by default.
Deno.serve(async (req: Request) => {
  const denied = checkInboundSecret(req);
  if (denied) return denied;
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
