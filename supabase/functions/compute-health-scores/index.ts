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
// Inbound manual-trigger secret (mirrors lib/auth/cron-auth.ts CRON_SECRET_<ROUTE>);
// per-function first, shared fallback. The Deno.cron schedule below does NOT go
// through the HTTP handler, so this gate never affects the real scheduled run.
const INBOUND_SECRET =
  Deno.env.get('CRON_SECRET_COMPUTE_HEALTH_SCORES') ?? CRON_SECRET;
// Log-only until EDGE_AUTH_ENFORCE=true (F2 rollout: deploy log-only -> set the
// per-function secret -> flip enforce). Log-only never blocks a caller.
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
      '[compute-health-scores] inbound secret missing/invalid (log-only; allowing). Set EDGE_AUTH_ENFORCE=true to block.'
    );
    return null;
  }
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

// HTTP handler for manual triggers and health checks (the Deno.cron schedule
// above bypasses this path). Gated by an inbound secret; log-only by default.
Deno.serve(async (req: Request) => {
  const denied = checkInboundSecret(req);
  if (denied) return denied;
  try {
    await runComputation();
    return new Response(JSON.stringify({ ok: true, triggered: 'manual' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[compute-health-scores] Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
