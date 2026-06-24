#!/usr/bin/env node
/**
 * capture-session.mjs — one-time SSO session capture for the dashboard audit.
 *
 * WHY THIS EXISTS:
 *   synthex.social accounts can sign in with "Continue with Google" (SSO), which
 *   has no email/password and can't be driven headlessly. This opens a REAL
 *   visible browser, lets you sign in normally (Google included) ONCE, and saves
 *   the authenticated session so dashboard-audit.mjs can reuse it — no password,
 *   no re-login.
 *
 * USAGE:
 *   node scripts/browser/capture-session.mjs [baseUrl]
 *   # then run the audit (it auto-detects the saved session):
 *   node scripts/browser/dashboard-audit.mjs [baseUrl]
 *
 * The session is written to .artifacts/browser-audit/session.json (gitignored —
 * it contains auth cookies; never commit it). Re-run this when it expires.
 *
 * EXIT CODES: 0 ok · 4 launch/timeout error.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] || process.env.SYNTHEX_BASE_URL || 'https://synthex.social';
const OUT = '.artifacts/browser-audit';
const STATE = process.env.SYNTHEX_STORAGE_STATE || `${OUT}/session.json`;
// Generous window for a manual (incl. Google + 2FA) sign-in.
const LOGIN_TIMEOUT = Number(process.env.SYNTHEX_LOGIN_TIMEOUT_MS || 300000);

await mkdir(OUT, { recursive: true });

// Headed on purpose — you need to see and complete the sign-in.
const browser = await chromium.launch({ headless: false });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.error('\n=== Synthex session capture ===');
  console.error(`A browser window has opened at ${BASE}/login.`);
  console.error('Sign in normally (use "Continue with Google" if that\'s your method).');
  console.error('Waiting until you reach the dashboard… (up to ' + Math.round(LOGIN_TIMEOUT / 1000) + 's)\n');

  try {
    await page.waitForURL(/\/(dashboard|onboarding|app|home)/, { timeout: LOGIN_TIMEOUT });
  } catch {
    console.error(
      'TIMED_OUT: did not reach a logged-in page in time. Re-run and finish sign-in faster, ' +
        'or set SYNTHEX_LOGIN_TIMEOUT_MS higher.'
    );
    process.exit(4);
  }

  await ctx.storageState({ path: STATE });
  console.error(`\n✓ Session saved to ${STATE}`);
  console.error('Now run:  node scripts/browser/dashboard-audit.mjs ' + BASE + '\n');
} catch (e) {
  console.error('RUNTIME_ERROR:', e?.message || e);
  process.exit(4);
} finally {
  await browser.close();
}
