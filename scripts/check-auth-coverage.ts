#!/usr/bin/env ts-node
/**
 * check-auth-coverage.ts — API route auth coverage CI check
 *
 * Scans every app/api\/**\/route.ts file and verifies it imports at least one
 * auth utility from a recognised auth module. Routes in the explicit allowlist
 * are exempt (public by design: webhooks, demo, health, auth endpoints, crons).
 *
 * MODES:
 *   Default  — Reports violations, exits 0 (informational, never blocks CI)
 *   --strict — Exits 1 on violations (enable once all pre-existing gaps are fixed)
 *
 * Run locally: npx tsx scripts/check-auth-coverage.ts
 * Run strict:  npx tsx scripts/check-auth-coverage.ts --strict
 *
 * @task SYN-607
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');

/**
 * Route path prefixes that are intentionally public (no user auth required).
 * These routes use alternative guards (Stripe signature, CRON_SECRET, etc.)
 * or are open by design.
 */
const EXEMPT_PREFIXES = [
  'app/api/auth/', // Login/signup/callback flows — auth endpoints themselves
  'app/api/webhooks/', // Stripe, SendGrid, platform webhooks — use signature verification
  'app/api/demo/', // Public demo endpoints (rate-limited, no user required)
  'app/api/health', // Health check — intentionally public
  'app/api/ping', // Health ping — intentionally public
  'app/api/internal/', // CRON_SECRET-protected internal jobs (not user auth)
  'app/api/cron/', // CRON_SECRET-protected background jobs (not user auth)
  'app/api/public/', // Explicitly public API endpoints
  'app/api/contact/', // Public contact form
  'app/api/blog/', // Public blog content API
  'app/api/newsletter/', // Public newsletter subscribe/unsubscribe
  'app/api/monitoring/', // Health/monitoring endpoints
  'app/api/affiliates/track/', // Public affiliate tracking
  'app/api/affiliates/webhook', // HMAC-signature-verified webhook (Stripe-style)
  'app/api/bio/', // Public link-in-bio page view tracking
  'app/api/journey/', // SYN-677 email pixels + click redirects (no session in email clients)
  'app/api/notifications/stream', // Deprecated — returns 410 to all callers
  'app/api/pr/channels', // Public static metadata catalogue
  'app/api/pr/press-releases/newsroom/', // Public newsroom for AI crawler indexing
  'app/api/reviews/google', // Public widget for landing pages (orgId in query, no PII)
  'app/api/waitlist', // Public sign-up, rate-limited via authStrict
];

/**
 * Import path patterns that indicate a route has auth protection.
 * Any import containing one of these strings counts as covered.
 */
const AUTH_IMPORT_PATTERNS = [
  '@/lib/auth/', // New canonical auth location (jwt-utils, with-auth)
  'lib/auth/', // Relative import of canonical auth
  '@/lib/middleware/withAuth', // Legacy middleware pattern (pre-SYN-607)
  '@/lib/middleware/auth', // Legacy auth middleware variant
  '@/lib/middleware/require-api-key', // requireApiKey() — service-to-service API key
  '@/lib/admin/verify-admin', // verifyAdmin() admin role gate
  '@/lib/security/api-security-checker', // APISecurityChecker (JWT + session)
  '@/lib/supabase-server', // createServerClient — server-side Supabase session
  'supabase.auth.getUser', // Inline Supabase token verification (header-based)
  'ADMIN_API_KEY', // Admin-key-protected routes
  'CRON_SECRET', // Cron-secret-protected routes not in cron/ prefix
  'UNITE_HUB_API_KEY', // Unite-Hub service API key (x-unite-hub-api-key header)
];

// ── Scanner ───────────────────────────────────────────────────────────────────

function isExempt(filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  return EXEMPT_PREFIXES.some(prefix => normalised.includes(prefix));
}

function hasAuthImport(content: string): boolean {
  return AUTH_IMPORT_PATTERNS.some(pattern => content.includes(pattern));
}

function check(): void {
  const routes = globSync('app/api/**/route.ts', {
    cwd: ROOT,
    absolute: false,
  });

  const violations: string[] = [];
  const exempt: string[] = [];
  const covered: string[] = [];

  for (const routeRelPath of routes) {
    if (isExempt(routeRelPath)) {
      exempt.push(routeRelPath);
      continue;
    }

    const absolutePath = path.join(ROOT, routeRelPath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    if (hasAuthImport(content)) {
      covered.push(routeRelPath);
    } else {
      violations.push(routeRelPath);
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  const total = routes.length;
  console.log(`\nAuth Coverage Check — ${total} routes scanned`);
  console.log(`  ✓ Covered : ${covered.length}`);
  console.log(`  ~ Exempt  : ${exempt.length}`);
  console.log(`  ✗ Missing : ${violations.length}`);

  if (violations.length > 0) {
    console.warn('\n⚠️  Routes missing auth imports:\n');
    for (const v of violations) {
      console.warn(`  ${v}`);
    }
    console.warn(
      '\nFix: import { withAuth } from "@/lib/auth/with-auth" and wrap your handler.'
    );
    console.warn(
      'If this route is intentionally public, add its prefix to EXEMPT_PREFIXES in scripts/check-auth-coverage.ts\n'
    );

    if (STRICT) {
      console.error('❌ Strict mode: failing due to auth coverage violations.');
      process.exit(1);
    }

    console.log('ℹ️  Run with --strict to fail CI on violations.');
    console.log(
      '   Enable --strict once all pre-existing gaps above are addressed.\n'
    );
  } else {
    console.log('\n✅ All protected routes have auth imports.\n');
  }
}

check();
