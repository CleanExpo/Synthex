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
import { hasAuthGuard, isExemptPath } from './auth-coverage-config';

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');

// EXEMPT_PREFIXES / AUTH_IMPORT_PATTERNS / AUTH_GUARD_PATTERNS live in
// scripts/auth-coverage-config.ts, shared with tests/auth/route-coverage.test.ts
// so the CLI report and the blocking CI ratchet cannot drift apart
// (independent review of a60c9f68, P3).

// ── Scanner ───────────────────────────────────────────────────────────────────

const isExempt = isExemptPath;

function hasAuthImport(content: string): boolean {
  return hasAuthGuard(content);
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
      'If this route is intentionally public, add its prefix to EXEMPT_PREFIXES in scripts/auth-coverage-config.ts\n'
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
