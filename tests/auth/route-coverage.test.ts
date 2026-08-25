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
import { hasAuthGuard, isExemptPath } from '../../scripts/auth-coverage-config';

// ── Configuration ─────────────────────────────────────────────────────────────

/** The number of pre-existing routes that lack a recognised auth import.
 *
 *  Audit history:
 *  - 2026-04-01: original baseline 186 (test silently broken — `fail()` ReferenceError)
 *  - 2026-04-30 (PR #142): dropped 186 → 17 after expanding AUTH_IMPORT_PATTERNS
 *    to recognise verifyAdmin + APISecurityChecker patterns.
 *  - 2026-04-30 (post-#142): dropped 17 → 0 after full audit:
 *      • 7 routes added to EXEMPT_PREFIXES (all genuinely public: journey pixels,
 *        public newsroom, distribution channels catalogue, deprecated SSE stream,
 *        HMAC-signed affiliate webhook, public reviews widget, waitlist sign-up)
 *      • 4 patterns added to AUTH_IMPORT_PATTERNS (require-api-key, supabase-server,
 *        inline supabase.auth.getUser, UNITE_GROUP_EVENTS_API_KEY)
 *      • 1 real security hole closed: app/api/brand-iq/next-steps wrapped in withAuth
 *        (was unauthenticated POST that allowed any caller to burn Anthropic credits)
 *      • 1 alias re-export documented: app/api/billing/subscription inherits
 *        APISecurityChecker from /api/user/subscription
 *
 *  Reduce this as routes are migrated. Never increase it. Any new violation must
 *  either be wrapped in withAuth/equivalent OR justified in EXEMPT_PREFIXES. */
const VIOLATION_BASELINE = 0;

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// EXEMPT_PREFIXES / AUTH_IMPORT_PATTERNS / AUTH_GUARD_IMPORTS now live in
// scripts/auth-coverage-config.ts so this test and scripts/check-auth-coverage.ts
// cannot drift apart (independent review of a60c9f68, P3).

// ── Helpers ───────────────────────────────────────────────────────────────────

const isExempt = isExemptPath;
const hasAuthImport = hasAuthGuard;

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
          `  - scripts/auth-coverage-config.ts (shared by this test and scripts/check-auth-coverage.ts)`
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

/**
 * The scanner recognises `authenticateIntentScapeRequest` from the TypeScript
 * AST — a real named import from lib/intentscape/api whose binding is actually
 * called — not from source text. Two review rounds killed the text-matching
 * versions: substring matching passed on a bare comment (a60c9f68, P2), and
 * regex matching still passed on an unused import paired with a commented-out
 * call, a fully commented import-and-call, or the name inside a string literal
 * (a9b5f0e8, P2). These fixtures hold that line.
 */
describe('authenticateIntentScapeRequest recognition', () => {
  const IMPORT_LINE = `import { authenticateIntentScapeRequest } from '@/lib/intentscape/api';`;
  const CALL_LINES =
    `  const auth = await authenticateIntentScapeRequest(request, 'read');\n` +
    `  if (!auth.allowed) return auth.response;\n`;

  it('rejects a route that only mentions the guard in a comment', () => {
    expect(
      hasAuthGuard(
        `// TODO: wrap this in authenticateIntentScapeRequest before shipping\n` +
          `export async function GET() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('rejects a route that imports the guard but never calls it', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('rejects a route that calls the guard without importing it', () => {
    expect(
      hasAuthGuard(
        `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a real import paired with a commented-out call', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n` +
          `  // const auth = await authenticateIntentScapeRequest(request, 'read');\n` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a fully commented-out import and call', () => {
    expect(
      hasAuthGuard(
        `/*\n${IMPORT_LINE}\n${CALL_LINES}*/\n` +
          `export async function GET() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('rejects the guard name appearing only inside a string literal', () => {
    expect(
      hasAuthGuard(
        `const guard = 'authenticateIntentScapeRequest(request, \\'read\\')';\n` +
          `export async function GET() { return new Response(guard); }\n`
      )
    ).toBe(false);
  });

  it('rejects a call to a same-named import from a different module', () => {
    expect(
      hasAuthGuard(
        `import { authenticateIntentScapeRequest } from '@/lib/fake/api';\n` +
          `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('accepts a route that imports and calls the guard', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(true);
  });

  it('rejects a parameter that shadows the imported guard name', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `export async function GET(request, authenticateIntentScapeRequest) {\n` +
          `  const auth = await authenticateIntentScapeRequest(request, 'read');\n` +
          `  return new Response(auth ? 'ok' : 'no');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a nested local that shadows the imported guard name', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n` +
          `  const authenticateIntentScapeRequest = async () => ({ allowed: true });\n` +
          `  const auth = await authenticateIntentScapeRequest(request, 'read');\n` +
          `  return new Response(auth.allowed ? 'ok' : 'no');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a type-only import of the guard', () => {
    expect(
      hasAuthGuard(
        `import type { authenticateIntentScapeRequest } from '@/lib/intentscape/api';\n` +
          `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a guard called only in an unused helper', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `async function neverCalled(request) {\n${CALL_LINES}  return auth;\n}\n` +
          `export async function GET() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('rejects a guard called only during module initialisation', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `const warmup = authenticateIntentScapeRequest;\n` +
          `void authenticateIntentScapeRequest(undefined, 'read');\n` +
          `export async function GET() { return new Response(String(warmup)); }\n`
      )
    ).toBe(false);
  });

  it('rejects a file where one exported handler is guarded and a sibling is not', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n` +
          `export async function POST() { return new Response('unguarded'); }\n`
      )
    ).toBe(false);
  });

  it('rejects a file with the guard imported and called but no exported handler', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nasync function handler(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a guard called only in an unused helper NESTED in the handler', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n` +
          `  async function neverCalled() {\n  ${CALL_LINES}    return auth;\n  }\n` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a guard evaluated while constructing an unguarded handler', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `const wrap = (fn) => fn;\n` +
          `export const GET = wrap(\n` +
          `  (authenticateIntentScapeRequest(undefined, 'read'), async () => new Response('ok'))\n` +
          `);\n`
      )
    ).toBe(false);
  });

  it('rejects a guard called only in an unused object getter', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n` +
          `  const probe = { get value() { return authenticateIntentScapeRequest(request, 'read'); } };\n` +
          `  return new Response(String(typeof probe));\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a guard called only in an unused object setter', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n` +
          `  const probe = { set value(v) { authenticateIntentScapeRequest(request, 'read'); } };\n` +
          `  return new Response(String(typeof probe));\n}\n`
      )
    ).toBe(false);
  });

  it('accepts a same-named local re-exported as the handler', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nasync function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\nexport { GET };\n`
      )
    ).toBe(true);
  });

  it('accepts a handler exported through a local alias', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nasync function handle(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\nexport { handle as GET };\n`
      )
    ).toBe(true);
  });

  it('accepts a handler assigned from a local function reference', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nasync function handle(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\nexport const GET = handle;\n`
      )
    ).toBe(true);
  });

  it('accepts every exported handler guarding itself', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n` +
          `export async function POST(request) {\n` +
          `  const auth = await authenticateIntentScapeRequest(request, 'write');\n` +
          `  if (!auth.allowed) return auth.response;\n` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(true);
  });

  it('accepts a handler exported as a const arrow function', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport const GET = async (request) => {\n${CALL_LINES}` +
          `  return new Response('ok');\n};\n`
      )
    ).toBe(true);
  });

  it('accepts an aliased import that is called under its alias', () => {
    expect(
      hasAuthGuard(
        `import { authenticateIntentScapeRequest as gate } from '@/lib/intentscape/api';\n` +
          `export async function GET(request) {\n` +
          `  const auth = await gate(request, 'read');\n` +
          `  if (!auth.allowed) return auth.response;\n` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(true);
  });

  it('accepts the real export route on disk', () => {
    const rel = 'app/api/intentscape/workspaces/[id]/export/route.ts';
    const abs = path.join(REPO_ROOT, rel);
    expect(fs.existsSync(abs)).toBe(true);
    expect(hasAuthGuard(fs.readFileSync(abs, 'utf8'))).toBe(true);
  });
});

/**
 * requireMissionOrg recognition.
 *
 * Adding a second entry to AUTH_GUARD_IMPORTS changes a SECURITY control, so it
 * gets its own negative controls rather than inheriting confidence from the
 * entry above. Each rejection case below must stay false; if one starts
 * returning true the recogniser has been loosened into something a route can
 * spoof.
 */
describe('requireMissionOrg recognition', () => {
  const IMPORT_LINE = `import { requireMissionOrg } from '@/lib/mission-control/api-auth';`;
  const CALL_LINES =
    `  const auth = await requireMissionOrg(request);\n` +
    `  if (!auth.ok) return auth.response;\n`;

  it('rejects an import of the guard that is never called', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\nexport async function GET() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('rejects a call with no import', () => {
    expect(
      hasAuthGuard(
        `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a same-named guard imported from a different module', () => {
    expect(
      hasAuthGuard(
        `import { requireMissionOrg } from '@/lib/not-really/api-auth';\n` +
          `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(false);
  });

  it('rejects a file where one handler is guarded and a sibling is not', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n` +
          `export async function POST() { return new Response('ok'); }\n`
      )
    ).toBe(false);
  });

  it('accepts an import paired with a real call', () => {
    expect(
      hasAuthGuard(
        `${IMPORT_LINE}\n` +
          `export async function GET(request) {\n${CALL_LINES}` +
          `  return new Response('ok');\n}\n`
      )
    ).toBe(true);
  });

  it('accepts the real mission-control repos route on disk', () => {
    const rel = 'app/api/mission-control/repos/route.ts';
    const abs = path.join(REPO_ROOT, rel);
    expect(fs.existsSync(abs)).toBe(true);
    expect(hasAuthGuard(fs.readFileSync(abs, 'utf8'))).toBe(true);
  });
});
