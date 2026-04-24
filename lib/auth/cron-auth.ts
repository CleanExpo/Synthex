/**
 * Cron route authentication — SYN-702
 *
 * Pre-existing pattern: every `/api/internal/*` and `/api/cron/*` route
 * checked `Bearer ${process.env.CRON_SECRET}`. One leaked secret exposed
 * all 21 high-impact internal routes (advisor brief generation, health
 * score computation, knowledge graph builds, Slack alerts, etc.) — there
 * was no scope isolation.
 *
 * This helper introduces per-route secret scoping while preserving
 * backward compatibility:
 *
 *   1. First checks `CRON_SECRET_<ROUTE_NAME>` (e.g. `CRON_SECRET_DELIVER_ADVISOR_BRIEF`)
 *   2. Falls back to shared `CRON_SECRET` if the per-route secret is unset
 *   3. Logs a warning when the fallback is used, so operators can see
 *      which routes still need per-route secrets configured
 *
 * Migration path: add `CRON_SECRET_<ROUTE_NAME>` env vars to Vercel
 * incrementally. Each route that gets its own secret is isolated from the
 * rest. No code changes required to adopt — just configure the env var.
 *
 * Usage:
 *
 *   import { verifyCronRequest } from '@/lib/auth/cron-auth';
 *
 *   export async function POST(request: NextRequest) {
 *     const auth = verifyCronRequest(request, 'DELIVER_ADVISOR_BRIEF');
 *     if (!auth.ok) return auth.response;
 *     // ...route logic...
 *   }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export type CronAuthResult =
  | { ok: true; scope: 'per-route' | 'shared-fallback' }
  | { ok: false; response: NextResponse };

/**
 * Build the env var name for a route's dedicated secret.
 * Route name is expected to be an all-uppercase slug (e.g. `DELIVER_ADVISOR_BRIEF`).
 */
export function perRouteSecretEnvName(routeName: string): string {
  return `CRON_SECRET_${routeName}`;
}

/** Pure decision — extracted for testability without NextResponse machinery. */
export type CronAuthDecision =
  | { outcome: 'missing-auth-header' }
  | { outcome: 'no-secret-configured' }
  | { outcome: 'mismatch' }
  | { outcome: 'per-route-match' }
  | { outcome: 'shared-fallback-match' };

export function decide(
  authHeader: string | null,
  routeName: string,
  env: Record<string, string | undefined> = process.env
): CronAuthDecision {
  if (!authHeader) return { outcome: 'missing-auth-header' };

  const perRouteSecret = env[perRouteSecretEnvName(routeName)];
  const sharedSecret = env.CRON_SECRET;

  if (!perRouteSecret && !sharedSecret) {
    return { outcome: 'no-secret-configured' };
  }

  // Per-route isolation: once a route has its own secret configured, the
  // shared CRON_SECRET no longer acts as a master key for that route.
  // This is the core security property — a leaked shared secret cannot
  // unlock routes that have been isolated.
  if (perRouteSecret) {
    return authHeader === `Bearer ${perRouteSecret}`
      ? { outcome: 'per-route-match' }
      : { outcome: 'mismatch' };
  }

  // No per-route secret configured → accept the shared secret (logged as
  // a warning by the caller so operators see which routes still need
  // isolation).
  return authHeader === `Bearer ${sharedSecret}`
    ? { outcome: 'shared-fallback-match' }
    : { outcome: 'mismatch' };
}

/**
 * Verify a cron-style request. Routes should call this at the top of their
 * handler and bail with the supplied NextResponse on failure.
 *
 * @param request Incoming NextRequest
 * @param routeName Uppercase slug identifying the route — e.g. `DELIVER_ADVISOR_BRIEF`.
 *                  Used to look up `CRON_SECRET_<ROUTE_NAME>` before falling back
 *                  to the shared `CRON_SECRET`.
 */
export function verifyCronRequest(
  request: NextRequest,
  routeName: string
): CronAuthResult {
  const decision = decide(request.headers.get('authorization'), routeName);

  switch (decision.outcome) {
    case 'per-route-match':
      return { ok: true, scope: 'per-route' };

    case 'shared-fallback-match':
      logger.warn(
        '[cron-auth] Authenticated via shared CRON_SECRET; per-route secret not configured',
        { routeName, recommendedEnv: perRouteSecretEnvName(routeName) }
      );
      return { ok: true, scope: 'shared-fallback' };

    case 'no-secret-configured':
      logger.error('[cron-auth] No cron secret configured', { routeName });
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Server misconfiguration' },
          { status: 500 }
        ),
      };

    case 'missing-auth-header':
    case 'mismatch':
    default:
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
      };
  }
}
