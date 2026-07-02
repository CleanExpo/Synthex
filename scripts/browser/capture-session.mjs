#!/usr/bin/env node
/**
 * capture-session.mjs — one-time SSO session capture for the dashboard audit.
 *
 * WHY THIS EXISTS:
 *   synthex.social accounts can sign in with "Continue with Google" (SSO).
 *   Google blocks automated/bundled browsers ("this browser may not be secure")
 *   and throwaway contexts don't persist the session — causing a sign-in loop.
 *   This uses your REAL installed Chrome with a PERSISTENT profile dir, so Google
 *   trusts it and the login sticks. You sign in once; dashboard-audit.mjs reuses
 *   the same profile.
 *
 * USAGE:
 *   node scripts/browser/capture-session.mjs [baseUrl]
 *   node scripts/browser/dashboard-audit.mjs [baseUrl]
 *
 * Profile dir: .artifacts/browser-audit/chrome-profile (gitignored — holds auth
 * cookies; never commit). Delete it to start fresh. Re-run this if it expires.
 *
 * EXIT CODES: 0 ok · 4 launch/timeout error.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] || process.env.SYNTHEX_BASE_URL || 'https://synthex.social';
const OUT = '.artifacts/browser-audit';
const PROFILE = process.env.SYNTHEX_PROFILE_DIR || `${OUT}/chrome-profile`;
const LOGIN_TIMEOUT = Number(process.env.SYNTHEX_LOGIN_TIMEOUT_MS || 300000);

await mkdir(PROFILE, { recursive: true });

// Real installed Chrome (channel:'chrome') + persistent profile — the combo that
// gets past Google's automation block and keeps the session.
let ctx;
try {
  ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  });
} catch (e) {
  console.error(
    'LAUNCH_FAILED: could not start real Chrome (channel:"chrome").\n' +
      '  Install Google Chrome, or run: npx playwright install chrome\n' +
      '  Detail: ' + (e?.message || e)
  );
  process.exit(4);
}

try {
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.error('\n=== Synthex session capture ===');
  console.error(`Chrome opened at ${BASE}/login.`);
  console.error('Sign in normally — use "Continue with Google".');
  console.error('Waiting until you reach the dashboard… (up to ' + Math.round(LOGIN_TIMEOUT / 1000) + 's)\n');

  try {
    await page.waitForURL(/\/(dashboard|onboarding|app|home)/, { timeout: LOGIN_TIMEOUT });
  } catch {
    console.error(
      'TIMED_OUT: did not reach a logged-in page. If you kept landing back on /login, ' +
        'the account may require extra Google verification — complete it, then re-run.'
    );
    process.exit(4);
  }

  console.error(`\n✓ Signed in. Session persisted to ${PROFILE}`);
  console.error('Now run:  node scripts/browser/dashboard-audit.mjs ' + BASE + '\n');
} catch (e) {
  console.error('RUNTIME_ERROR:', e?.message || e);
  process.exit(4);
} finally {
  await ctx.close();
}
