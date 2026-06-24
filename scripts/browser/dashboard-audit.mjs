#!/usr/bin/env node
/**
 * dashboard-audit.mjs — reliable, extension-free browser automation for Synthex.
 *
 * WHY THIS EXISTS:
 *   The Chrome extension / computer_use bridge needs a manual per-session sign-in
 *   + toggle and drops frequently. This script needs NONE of that — it drives a
 *   headless Chromium via the project's installed Playwright. No MCP bridge, no
 *   extension, no human clicking. It is the canonical way to inspect authenticated
 *   dashboard surfaces. (See `.claude/skills/browser-auth/SKILL.md`.)
 *
 * WHAT IT DOES:
 *   1. Authenticates one of two ways:
 *        (a) a saved SSO session from capture-session.mjs (preferred — works with
 *            "Continue with Google"), auto-detected at .artifacts/browser-audit/session.json
 *            or $SYNTHEX_STORAGE_STATE; or
 *        (b) email/password login at <base>/login via SYNTHEX_TEST_EMAIL / SYNTHEX_TEST_PASSWORD.
 *   2. Visits each integration surface, screenshots it (.artifacts/browser-audit/),
 *      and scrapes visible text for connected / not-connected / empty / error signals.
 *   3. Prints a JSON report to stdout.
 *
 * USAGE:
 *   # SSO accounts (Google sign-in) — capture a session once, then audit:
 *   node scripts/browser/capture-session.mjs [baseUrl]
 *   node scripts/browser/dashboard-audit.mjs [baseUrl]
 *
 *   # email/password accounts (creds in .env.local, Node 20+ built-in):
 *   node --env-file=.env.local scripts/browser/dashboard-audit.mjs [baseUrl]
 *   # headed (watch it run):
 *   PWDEBUG_HEADED=1 node scripts/browser/dashboard-audit.mjs
 *
 * EXIT CODES: 0 ok · 2 no auth available · 3 auth failed/expired · 4 runtime/launch error.
 *
 * MAINTENANCE: login selectors and ROUTES are the only things that drift —
 * see the Maintenance section of the browser-auth SKILL before editing.
 */
import { chromium } from 'playwright';
import { mkdir, access } from 'node:fs/promises';

const BASE = process.argv[2] || process.env.SYNTHEX_BASE_URL || 'https://synthex.social';
const EMAIL = process.env.SYNTHEX_TEST_EMAIL;
const PASSWORD = process.env.SYNTHEX_TEST_PASSWORD;
const OUT = '.artifacts/browser-audit';
const STATE = process.env.SYNTHEX_STORAGE_STATE || `${OUT}/session.json`;
const HEADED = process.env.PWDEBUG_HEADED === '1';

const hasState = await access(STATE).then(() => true).catch(() => false);

// Login form selectors (verified 2026-05-30 against synthex.social/login).
const SEL = {
  email: '#email',
  password: '#password',
  // Two submit buttons exist ("Watch Tutorial" + "Sign in") — target by text.
  submit: 'button:has-text("Sign in")',
};

// Integration surfaces to audit. Extend as the dashboard grows.
const ROUTES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'integrations', path: '/dashboard/integrations' },
  { name: 'analytics', path: '/dashboard/analytics' },
  { name: 'google-business', path: '/dashboard/google-business' },
];

function classify(text) {
  const t = text.toLowerCase();
  return {
    notConnected: /not connected|connect your|reconnect|disconnected|no account connected/.test(t),
    connected: /\bconnected\b|last sync|syncing|active connection/.test(t),
    empty: /no data|nothing here|get started|no .* yet|empty/.test(t),
    error: /something went wrong|failed to load|unable to load|an error occurred/.test(t),
  };
}

if (!hasState && (!EMAIL || !PASSWORD)) {
  console.error(
    'NO_AUTH: no saved session and no email/password.\n' +
      '  • Google/SSO account → run: node scripts/browser/capture-session.mjs ' + BASE + '\n' +
      '  • email/password account → set SYNTHEX_TEST_EMAIL and SYNTHEX_TEST_PASSWORD.\n' +
      'See .claude/skills/browser-auth/SKILL.md.'
  );
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: !HEADED });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(hasState ? { storageState: STATE } : {}),
  });
  const page = await ctx.newPage();

  // --- Authenticate ---
  if (hasState) {
    // Reuse the captured SSO session. Verify it's still valid by hitting the
    // dashboard and confirming we don't bounce back to /login.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (/\/login/.test(new URL(page.url()).pathname)) {
      await page.screenshot({ path: `${OUT}/session-expired.png` });
      console.error(
        'SESSION_EXPIRED: saved session is no longer valid. Re-capture it:\n' +
          '  node scripts/browser/capture-session.mjs ' + BASE
      );
      process.exit(3);
    }
  } else {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(SEL.email, { timeout: 15000 });
    await page.fill(SEL.email, EMAIL);
    await page.fill(SEL.password, PASSWORD);
    await page.click(SEL.submit);

    try {
      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });
    } catch {
      await page.screenshot({ path: `${OUT}/login-failed.png` });
      console.error(
        'LOGIN_FAILED: still on /login after submit (wrong creds, rate limit, or selector drift). ' +
          `See ${OUT}/login-failed.png`
      );
      process.exit(3);
    }
  }

  const landed = new URL(page.url()).pathname;

  // --- Audit each surface ---
  const audited = [];
  for (const r of ROUTES) {
    try {
      await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500); // let client-side data settle (no networkidle — dashboard holds connections open)
      const shot = `${OUT}/${r.name}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      const text = await page.evaluate(() => document.body.innerText || '');
      audited.push({ surface: r.name, path: r.path, url: page.url(), screenshot: shot, signals: classify(text) });
    } catch (e) {
      audited.push({ surface: r.name, path: r.path, error: String(e?.message || e) });
    }
  }

  console.log(JSON.stringify({ base: BASE, landedAfterLogin: landed, audited }, null, 2));
} catch (e) {
  console.error('RUNTIME_ERROR:', e?.message || e);
  process.exit(4);
} finally {
  await browser.close();
}
