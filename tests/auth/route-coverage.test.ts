/**
 * Auth coverage regression test — SYN-609
 *
 * Scans all app/api\/**\/route.ts files and asserts that each protected
 * route imports an auth utility from @/lib/auth/.
 *
 * RATCHET MECHANISM:
 *   The VIOLATION_BASELINE constant tracks the number of pre-existing
 *   routes that don't yet use withAuth(). The test fails if violations
 *   INCREASE (new unprotected routes added). Reduce the baseline as
 *   routes are migrated to withAuth() — never increase it.
 *
 *   To fix a violation: import { withAuth } from '@/lib/auth/with-auth'
 *   and wrap your route handler.
 *
 * CONTRIBUTING:
 *   All new API routes MUST use withAuth() from lib/auth/with-auth.
 *   This test will block your PR if you add an unprotected route.
 *   See CONTRIBUTING.md § API Routes for the required pattern.
 *
 * @task SYN-609
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// ── Configuration ─────────────────────────────────────────────────────────────

/** The number of pre-existing routes that lack a recognised auth import.
 *  Updated 2026-04-30: dropped from 186 → 17 after expanding AUTH_IMPORT_PATTERNS
 *  to recognise verifyAdmin (`@/lib/admin/verify-admin`) and APISecurityChecker
 *  (`@/lib/security/api-security-checker`) — both are valid auth gates that
 *  the test previously missed.
 *
 *  The remaining 17 need individual audit: some are genuinely public (webhook,
 *  journey pixels, waitlist, newsroom slugs) and should move to EXEMPT_PREFIXES;
 *  others (user/account, user/change-password, billing) need wrapping. Tracked
 *  for follow-up.
 *
 *  Reduce this as routes are migrated. Never increase it. */
const VIOLATION_BASELINE = 17;

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const EXEMPT_PREFIXES = [
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
  'app/api/bio/',
];

const AUTH_IMPORT_PATTERNS = [
  '@/lib/auth/',
  'lib/auth/',
  '@/lib/middleware/withAuth',
  '@/lib/middleware/auth',
  '@/lib/admin/verify-admin', // verifyAdmin() — admin role gate
  '@/lib/security/api-security-checker', // APISecurityChecker — JWT + session
  'ADMIN_API_KEY',
  'CRON_SECRET',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(p: string) {
  return p.replace(/\\/g, '/');
}

function isExempt(relPath: string): boolean {
  const norm = normalise(relPath);
  return EXEMPT_PREFIXES.some(prefix => norm.includes(prefix));
}

function hasAuthImport(content: string): boolean {
  return AUTH_IMPORT_PATTERNS.some(pattern => content.includes(pattern));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('API Route Auth Coverage', () => {
  let routes: string[];
  let violations: string[];
  let exempt: string[];

  beforeAll(() => {
    routes = globSync('app/api/**/route.ts', {
      cwd: REPO_ROOT,
      absolute: false,
    });

    violations = [];
    exempt = [];

    for (const rel of routes) {
      if (isExempt(rel)) {
        exempt.push(rel);
        continue;
      }
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      if (!hasAuthImport(content)) {
        violations.push(rel);
      }
    }
  });

  it('finds API route files to scan', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should not have MORE unprotected routes than the baseline (ratchet)', () => {
    if (violations.length > VIOLATION_BASELINE) {
      const newViolations = violations.slice(VIOLATION_BASELINE);
      // Note: `fail()` was removed in Jest 27+. Throw an Error to surface the
      // ratchet breach with full context (the message replaces what `fail()` would have shown).
      throw new Error(
        `Auth coverage ratchet breached. ${violations.length} violations found (baseline: ${VIOLATION_BASELINE}).\n` +
          `New unprotected routes detected:\n${newViolations.map(v => `  - ${v}`).join('\n')}\n\n` +
          `Fix: import { withAuth } from '@/lib/auth/with-auth' and wrap your handler.\n` +
          `If this route is intentionally public, add its prefix to EXEMPT_PREFIXES in:\n` +
          `  - tests/auth/route-coverage.test.ts\n` +
          `  - scripts/check-auth-coverage.ts`
      );
    }
    // If we're below baseline, that's great — log it to encourage further reduction
    if (violations.length < VIOLATION_BASELINE) {
      console.log(
        `✅ Auth coverage improved: ${violations.length} violations (baseline was ${VIOLATION_BASELINE}). ` +
          `Consider lowering VIOLATION_BASELINE to ${violations.length} in tests/auth/route-coverage.test.ts.`
      );
    }
    expect(violations.length).toBeLessThanOrEqual(VIOLATION_BASELINE);
  });

  it('withAuth routes: lib/auth/with-auth.ts exports withAuth and AuthContext', () => {
    const withAuthPath = path.join(REPO_ROOT, 'lib/auth/with-auth.ts');
    expect(fs.existsSync(withAuthPath)).toBe(true);
    const content = fs.readFileSync(withAuthPath, 'utf8');
    expect(content).toContain('export function withAuth');
    expect(content).toContain('export interface AuthContext');
  });

  it('newly written sprint routes use withAuth (SYN-593/595/597/598/599)', () => {
    const sprintRoutes = [
      'app/api/advisor/brief/route.ts',
      'app/api/advisor/feedback/route.ts',
      'app/api/team/invite-prompt/route.ts',
      'app/api/collaborator/context/route.ts',
    ];

    for (const rel of sprintRoutes) {
      const absPath = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(absPath)) continue; // route may not exist yet
      const content = fs.readFileSync(absPath, 'utf8');
      expect(content).toMatch(
        /from ['"]@\/lib\/auth\//,
        `Sprint route ${rel} must import from @/lib/auth/`
      );
    }
  });
});
