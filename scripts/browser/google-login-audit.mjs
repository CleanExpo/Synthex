#!/usr/bin/env node
/**
 * google-login-audit.mjs — interactive Google sign-in + dashboard audit.
 *
 * For accounts that ONLY have Google SSO (no email/password). Opens a REAL Chrome
 * window; YOU complete the Google sign-in by hand (Claude never types your Google
 * password). The script then saves the session to .artifacts/auth-state.json and
 * audits each integration surface. Future runs can reuse the saved session:
 *   node scripts/browser/dashboard-audit.mjs --reuse   (until the session expires)
 *
 * USAGE:
 *   node scripts/browser/google-login-audit.mjs [baseUrl]
 *
 * NOTE: not fully autonomous — a Google session expires and must be re-done. A
 * dedicated email/password test account is the only hands-off path (see SKILL).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] || process.env.SYNTHEX_BASE_URL || 'https://synthex.social';
const OUT = '.artifacts/browser-audit';
const STATE = '.artifacts/auth-state.json';
const LOGIN_TIMEOUT_MS = 180000; // 3 min for you to complete Google sign-in

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

await mkdir(OUT, { recursive: true });

// Use the real installed Google Chrome (channel:'chrome') headed — far less likely
// to be blocked by Google's automation detection than bundled headless Chromium.
const browser = await chromium.launch({ headless: false, channel: 'chrome' });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.error('\n========================================================');
  console.error('  A Chrome window has opened. Click "Continue with Google"');
  console.error('  and complete the sign-in. Waiting up to 3 minutes…');
  console.error('========================================================\n');

  try {
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: LOGIN_TIMEOUT_MS });
  } catch {
    await page.screenshot({ path: `${OUT}/google-login-timeout.png` });
    console.error(`LOGIN_TIMEOUT: did not reach /dashboard within 3 min. See ${OUT}/google-login-timeout.png`);
    process.exit(3);
  }

  // Persist the authenticated session for reuse.
  await ctx.storageState({ path: STATE });
  console.error(`SESSION SAVED → ${STATE}`);

  const landed = new URL(page.url()).pathname;
  const audited = [];
  for (const r of ROUTES) {
    try {
      await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const shot = `${OUT}/${r.name}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      const text = await page.evaluate(() => document.body.innerText || '');
      audited.push({ surface: r.name, path: r.path, url: page.url(), screenshot: shot, signals: classify(text) });
    } catch (e) {
      audited.push({ surface: r.name, path: r.path, error: String(e?.message || e) });
    }
  }

  console.log(JSON.stringify({ base: BASE, landedAfterLogin: landed, sessionSaved: STATE, audited }, null, 2));
} catch (e) {
  console.error('RUNTIME_ERROR:', e?.message || e);
  process.exit(4);
} finally {
  await browser.close();
}
