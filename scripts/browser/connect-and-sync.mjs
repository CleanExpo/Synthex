#!/usr/bin/env node
/**
 * connect-and-sync.mjs — drive Synthex's own authenticated APIs from your
 * logged-in browser session to do the integration chores that otherwise need
 * manual clicking: switch brand, run "Sync from Google" (GSC property sync),
 * trigger a platform OAuth connect, and report connection status.
 *
 * WHY THIS EXISTS:
 *   A network-restricted agent can't reach the authenticated app. This runs on
 *   YOUR machine, reusing the persistent Chrome profile from capture-session.mjs
 *   (so you're already signed in). It calls the same endpoints the dashboard
 *   calls — `PATCH /api/businesses/switch`, `POST /api/seo/search-console/properties`
 *   (this IS the "Sync from Google" button), `GET /api/auth/connections` — using
 *   the session cookies, so no DOM scraping and nothing fragile.
 *
 *   The ONLY step that still needs you is the Google/Meta OAuth consent screen
 *   (a third-party login you must complete in person) — for `connect`, the script
 *   opens that page and waits while you approve, then verifies the result.
 *
 * SETUP (one time):
 *   npm install && npx playwright install chrome
 *   node scripts/browser/capture-session.mjs https://synthex.social   # sign in once
 *
 * USAGE:
 *   # Read-only overview of every brand's Google connections + GSC properties:
 *   node scripts/browser/connect-and-sync.mjs status
 *
 *   # Run "Sync from Google" for a brand (registers properties; no OAuth popup):
 *   node scripts/browser/connect-and-sync.mjs sync-gsc "CARSI"
 *
 *   # Connect a platform for a brand (opens the Google/Meta consent for you):
 *   node scripts/browser/connect-and-sync.mjs connect "CCW" searchconsole
 *   node scripts/browser/connect-and-sync.mjs connect "Synthex" googledrive
 *
 * PLATFORMS: searchconsole · googleanalytics · googlebusiness · googledrive · facebook · instagram
 *
 * EXIT CODES: 0 ok · 2 not signed in (run capture-session) · 3 action failed · 4 launch/usage error.
 */
import { chromium } from 'playwright';
import { access } from 'node:fs/promises';

const BASE = process.env.SYNTHEX_BASE_URL || 'https://synthex.social';
const OUT = '.artifacts/browser-audit';
const PROFILE = process.env.SYNTHEX_PROFILE_DIR || `${OUT}/chrome-profile`;
const GOOGLE_PLATFORMS = ['searchconsole', 'googleanalytics', 'googlebusiness', 'googledrive'];
const ALL_PLATFORMS = [...GOOGLE_PLATFORMS, 'facebook', 'instagram'];
const OAUTH_WAIT_MS = Number(process.env.SYNTHEX_OAUTH_WAIT_MS || 180000);

const [, , command = 'status', brandArg, platformArg] = process.argv;

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

const hasProfile = await access(PROFILE).then(() => true).catch(() => false);
if (!hasProfile) {
  die(
    2,
    'NOT_SIGNED_IN: no captured session.\n' +
      '  Run first:  node scripts/browser/capture-session.mjs ' + BASE
  );
}

let ctx;
try {
  ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  });
} catch (e) {
  die(4, 'LAUNCH_FAILED: could not start real Chrome. Run `npx playwright install chrome`.\n  ' + (e?.message || e));
}

// ctx.request shares the persistent context's cookies → calls are authenticated.
const api = ctx.request;
const headers = { 'content-type': 'application/json', origin: BASE, referer: `${BASE}/dashboard` };

async function getJSON(path) {
  const res = await api.get(`${BASE}${path}`, { headers });
  return { ok: res.ok(), status: res.status(), body: await res.json().catch(() => null) };
}
async function sendJSON(method, path, data) {
  const res = await api.fetch(`${BASE}${path}`, { method, headers, data: JSON.stringify(data) });
  return { ok: res.ok(), status: res.status(), body: await res.json().catch(() => null) };
}

async function resolveBusinesses() {
  const r = await getJSON('/api/businesses');
  if (r.status === 401) die(2, 'NOT_SIGNED_IN: session expired. Re-run capture-session.mjs.');
  if (!r.ok) die(3, `Failed to list businesses (HTTP ${r.status}).`);
  // The endpoint may return an array or { businesses: [...] }.
  const list = Array.isArray(r.body) ? r.body : r.body?.businesses || r.body?.data || [];
  return list.map(b => ({ id: b.id || b.organizationId, name: b.name, slug: b.slug }));
}

function findBrand(businesses, name) {
  if (!name) die(4, 'USAGE: a brand name is required, e.g. "CARSI".');
  const hit = businesses.find(b => (b.name || '').toLowerCase() === name.toLowerCase());
  if (!hit) {
    die(4, `Brand "${name}" not found. Available: ${businesses.map(b => b.name).join(', ')}`);
  }
  return hit;
}

async function switchBrand(org) {
  const r = await sendJSON('PATCH', '/api/businesses/switch', { organizationId: org.id });
  if (!r.ok) die(3, `Failed to switch to ${org.name} (HTTP ${r.status}).`);
  console.error(`✓ Active brand → ${org.name}`);
}

async function gscProperties() {
  const r = await getJSON('/api/seo/search-console/properties');
  return r.ok ? r.body?.properties || r.body || [] : [];
}

async function connectionsFor(org) {
  const r = await getJSON(`/api/auth/connections?organizationId=${encodeURIComponent(org.id)}`);
  return r.ok ? r.body?.connections || r.body || [] : [];
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdStatus(businesses) {
  const report = [];
  for (const org of businesses) {
    await switchBrand(org);
    const conns = await connectionsFor(org);
    const byPlatform = {};
    for (const p of ALL_PLATFORMS) {
      const c = (Array.isArray(conns) ? conns : []).find(x => x.platform === p);
      byPlatform[p] = !c ? 'missing' : c.needsReconnect ? 'reconnect' : c.connected ? 'connected' : 'inactive';
    }
    report.push({ brand: org.name, connections: byPlatform });
  }
  console.log(JSON.stringify(report, null, 2));
}

async function cmdSyncGsc(businesses) {
  const org = findBrand(businesses, brandArg);
  await switchBrand(org);
  console.error(`→ Running "Sync from Google" for ${org.name}…`);
  const r = await sendJSON('POST', '/api/seo/search-console/properties', {});
  if (!r.ok) {
    die(3, `Sync failed (HTTP ${r.status}): ${JSON.stringify(r.body)}`);
  }
  const props = await gscProperties();
  const summary = (Array.isArray(props) ? props : []).map(p => ({
    siteUrl: p.siteUrl,
    permissionLevel: p.permissionLevel,
    isPrimary: p.isPrimary,
    // siteOwner / siteFullUser → real data will flow; siteUnverifiedUser → 0 data.
    willReturnData: ['siteOwner', 'siteFullUser', 'siteRestrictedUser'].includes(p.permissionLevel),
  }));
  console.log(JSON.stringify({ brand: org.name, synced: summary.length, properties: summary }, null, 2));
  const unverified = summary.filter(p => p.permissionLevel === 'siteUnverifiedUser');
  if (summary.length === 0) {
    console.error('⚠ No properties returned — the connected Google account sees no Search Console sites for this brand.');
  } else if (unverified.length) {
    console.error(
      `⚠ ${unverified.length} property(ies) are siteUnverifiedUser → Google returns ZERO data for those. ` +
        'Verify that account as an owner in the GSC console, or reconnect with the owning account.'
    );
  } else {
    console.error('✓ Properties registered with usable permission levels — real ranking data will ingest on the next sync cycle.');
  }
}

async function cmdConnect(businesses) {
  const org = findBrand(businesses, brandArg);
  if (!platformArg || !ALL_PLATFORMS.includes(platformArg)) {
    die(4, `USAGE: connect "<brand>" <platform>. Platform one of: ${ALL_PLATFORMS.join(', ')}`);
  }
  await switchBrand(org);

  const before = await connectionsFor(org);
  const wasConnected = (Array.isArray(before) ? before : []).some(
    c => c.platform === platformArg && c.connected && !c.needsReconnect
  );

  console.error(`\n→ Opening the ${platformArg} consent for ${org.name}.`);
  console.error('  Complete the Google/Meta sign-in + approval in the window that opens.');
  console.error(`  Waiting up to ${Math.round(OAUTH_WAIT_MS / 1000)}s for it to land back on the dashboard…\n`);

  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(`${BASE}/api/auth/oauth/${platformArg}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait until we're back on a Synthex dashboard/integrations page (consent done).
  try {
    await page.waitForURL(/synthex\.social\/(dashboard|integrations|settings)/, { timeout: OAUTH_WAIT_MS });
  } catch {
    console.error('⚠ Did not detect a return to the dashboard. If you finished consent, the verify step below still runs.');
  }
  await page.waitForTimeout(2500); // let the callback persist the connection

  const after = await connectionsFor(org);
  const now = (Array.isArray(after) ? after : []).find(c => c.platform === platformArg);
  const ok = now && now.connected && !now.needsReconnect;
  console.log(
    JSON.stringify(
      { brand: org.name, platform: platformArg, wasConnected, nowConnected: !!ok, detail: now || null },
      null,
      2
    )
  );
  if (!ok) {
    die(
      3,
      `✗ ${platformArg} for ${org.name} is still not connected. If the consent showed "App not active" (Facebook), ` +
        'the Meta app is in Development Mode — see Linear SYN-1054.'
    );
  }
  console.error(`✓ ${platformArg} connected for ${org.name}.`);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

try {
  const businesses = await resolveBusinesses();
  if (command === 'status') await cmdStatus(businesses);
  else if (command === 'sync-gsc') await cmdSyncGsc(businesses);
  else if (command === 'connect') await cmdConnect(businesses);
  else die(4, `Unknown command "${command}". Use: status | sync-gsc | connect`);
} catch (e) {
  die(3, 'RUNTIME_ERROR: ' + (e?.message || e));
} finally {
  await ctx.close();
}
