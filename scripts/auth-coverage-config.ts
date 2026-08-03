/**
 * auth-coverage-config.ts — single source of truth for API route auth coverage.
 *
 * Consumed by BOTH scanners:
 *   - tests/auth/route-coverage.test.ts  (the blocking CI ratchet)
 *   - scripts/check-auth-coverage.ts     (the informational CLI report)
 *
 * They previously kept private copies of these lists and had already drifted:
 * the test recognised `resolveOrgFromBearer` and exempted
 * `app/api/video/webhook/fal/` + `app/api/admin/private-refs`; the script did
 * not. Local and CI answers could therefore disagree (independent review of
 * a60c9f68, P3). The values below are the test's — the blocking gate's — so
 * consolidation does not loosen the ratchet.
 *
 * Side-effect free by design: importing this must never touch the filesystem
 * or process argv.
 *
 * @task SYN-607
 */

/**
 * Route path prefixes that are intentionally public (no user session).
 * These use an alternative guard — webhook signature, CRON_SECRET, signed
 * token — or are open by design.
 */
export const EXEMPT_PREFIXES: readonly string[] = [
  'app/api/auth/',
  'app/api/webhooks/',
  'app/api/demo/',
  'app/api/health',
  'app/api/ping',
  'app/api/internal/',
  'app/api/cron/',
  'app/api/public/',
  'app/api/contact/',
  'app/api/blog/',
  'app/api/newsletter/',
  'app/api/monitoring/',
  'app/api/affiliates/track/',
  'app/api/affiliates/webhook', // HMAC-signature-verified webhook (Stripe-style)
  'app/api/video/webhook/fal/', // FAL_WEBHOOK_SECRET token-verified webhook (fal.ai callback)
  'app/api/bio/',
  'app/api/credential-intake', // Signed-token public intake; no user session for external CCW/provider staff
  'app/api/journey/', // SYN-677 email pixels + click redirects (no session in email clients)
  'app/api/notifications/stream', // Deprecated — returns 410 to all callers
  'app/api/pr/channels', // Public static metadata catalogue
  'app/api/pr/press-releases/newsroom/', // Public newsroom for AI crawler indexing
  'app/api/reviews/google', // Public widget for landing pages (orgId in query, no PII)
  'app/api/waitlist', // Public sign-up, rate-limited via authStrict
  'app/api/opportunity-map/', // Public scan, feedback and consent-bound handoff; same-origin + rate-limited
  'app/api/v1/connections/status', // #492 Mission Control status manifest — presence-only booleans, no secrets/PII/org data
  'app/api/admin/private-refs', // #740 Signed-token ingest (x-ingest-token, timingSafeEqual, fail-closed); no user session
];

/**
 * Substring patterns that indicate a route imports a recognised auth utility.
 *
 * Substring matching is deliberately kept for the pre-existing entries — they
 * are module paths and env-var names, and tightening them is a separate change
 * with its own regression risk. New guards go in AUTH_GUARD_PATTERNS below.
 */
export const AUTH_IMPORT_PATTERNS: readonly string[] = [
  '@/lib/auth/', // New canonical auth location (jwt-utils, with-auth)
  'lib/auth/', // Relative import of canonical auth
  '@/lib/api/define-route', // defineRoute()/defineOrgRoute() — always wrap withAuth/withOrg (WS5)
  '@/lib/middleware/withAuth', // Legacy middleware pattern (pre-SYN-607)
  '@/lib/middleware/auth', // Legacy auth middleware variant
  '@/lib/middleware/require-api-key', // requireApiKey() — service-to-service API key
  '@/lib/admin/verify-admin', // verifyAdmin() — admin role gate
  '@/lib/security/api-security-checker', // APISecurityChecker — JWT + session
  '@/lib/supabase-server', // createServerClient — server-side Supabase session
  'supabase.auth.getUser', // Inline Supabase token verification (header-based)
  'ADMIN_API_KEY',
  'CRON_SECRET',
  'UNITE_GROUP_EVENTS_API_KEY', // Unite-Group service API key (x-unite-group-api-key header)
  'resolveOrgFromBearer', // MCP bearer-token org resolution
];

/**
 * Structural patterns for guards recognised by call site rather than by import
 * string. Each must require the guard to actually be IMPORTED and CALLED, so a
 * comment mentioning it, or an unused import, still counts as a violation.
 */
export const AUTH_GUARD_PATTERNS: readonly {
  name: string;
  imported: RegExp;
  called: RegExp;
}[] = [
  {
    // IntentScape gate — wraps APISecurityChecker.check(AUTHENTICATED_READ|WRITE)
    // + getEffectiveOrganizationId(), 401/403 fail-closed (lib/intentscape/api.ts).
    name: 'authenticateIntentScapeRequest',
    imported:
      /import\s*\{[^}]*\bauthenticateIntentScapeRequest\b[^}]*\}\s*from\s*['"][^'"]*lib\/intentscape\/api['"]/s,
    called: /\bauthenticateIntentScapeRequest\s*\(/,
  },
];

/** True when the file content shows a recognised auth guard. */
export function hasAuthGuard(content: string): boolean {
  if (AUTH_IMPORT_PATTERNS.some(pattern => content.includes(pattern))) {
    return true;
  }
  return AUTH_GUARD_PATTERNS.some(
    guard => guard.imported.test(content) && guard.called.test(content)
  );
}

/** True when the route path is on the intentionally-public allowlist. */
export function isExemptPath(relPath: string): boolean {
  const normalised = relPath.replace(/\\/g, '/');
  return EXEMPT_PREFIXES.some(prefix => normalised.includes(prefix));
}
