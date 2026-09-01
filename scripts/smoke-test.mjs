#!/usr/bin/env node
// scripts/smoke-test.mjs — Smoke test suite for live Synthex deployment
// Usage: BASE_URL=https://synthex.social node scripts/smoke-test.mjs
// Exit 0 = all pass, Exit 1 = any fail

const BASE_URL = process.env.BASE_URL || 'https://synthex.social';
const TIMEOUT_MS = 10000;

// `isHome` supplies the baseline document; `distinctFromHome` marks a page that
// must NOT be the homepage. Order matters: '/' is fetched before its dependants.
const tests = [
  { method: 'GET', path: '/api/health', acceptStatus: [200, 503] },
  { method: 'GET', path: '/api/health/live', acceptStatus: [200] },
  { method: 'GET', path: '/api/health/ready', acceptStatus: [200, 503] },
  { method: 'GET', path: '/', acceptStatus: [200], isHome: true },
  {
    method: 'GET',
    path: '/login',
    acceptStatus: [200],
    distinctFromHome: true,
  },
  {
    method: 'GET',
    path: '/pricing',
    acceptStatus: [200],
    distinctFromHome: true,
  },
  { method: 'HEAD', path: '/api/health', acceptStatus: [200] },
];

const BASE_ORIGIN = new URL(BASE_URL).origin;

/** Normalise for comparison: strip trailing slashes, keep root as '/'. */
const normalisePath = p => p.replace(/\/+$/, '') || '/';

/**
 * WHERE A REQUEST IS ALLOWED TO END UP.
 *
 * `redirect: 'follow'` plus a status-only check answers "did SOME page respond
 * 200", not "did THIS route respond". A broken router that sends /login and
 * /pricing to the homepage returns 200 on every path, so this script printed
 * 7/7 and exited 0 for a site where both advertised routes were absent - and
 * this script runs in the REQUIRED post-deploy job, so that green was the whole
 * gate.
 *
 * Origin is compared as well as pathname: a redirect to another host serving
 * the same path is not this site.
 *
 * Default is strict. Add an entry only with evidence that production really
 * redirects, and say what that evidence was.
 */
const ALLOWED_FINAL_PATHS = {};

/**
 * IS THIS ACTUALLY THE REQUESTED PAGE, OR THE HOMEPAGE WEARING ITS URL?
 *
 * Status, origin and pathname together still do not identify the RESOURCE. An
 * internal rewrite or a catch-all fallback can serve homepage HTML at /login
 * with status 200 and the URL preserved, and every check above passes - so the
 * required gate certifies a deploy where the advertised pages do not exist.
 * `redirect: 'manual'` does not help: no redirect occurs.
 *
 * The discriminator is the document <title>, compared DIFFERENTIALLY against the
 * homepage rather than against hardcoded copy. Measured on production
 * 2026-09-01:
 *     /        "Free Marketing Opportunity Map | Synthex"
 *     /login   "Login | Synthex | SYNTHEX"
 *     /pricing "Pilot Access | Synthex | SYNTHEX"
 * A marketing rewording keeps this passing; the homepage served at /login does
 * not.
 *
 * Why not a DOM marker such as a password field: /login is client-rendered and
 * ships no password input in its HTML, so that check would fail against healthy
 * production. Why not the canonical link: /pricing's canonical points at the
 * homepage today, so it does not discriminate. Both were measured, not assumed.
 */
const titleOf = html =>
  (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();

let homeTitle = null;

async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: test.method,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;

    const statusOk = test.acceptStatus.includes(res.status);

    // res.url is the FINAL url after any redirects.
    const finalUrl = new URL(res.url || url);
    const permitted = [
      test.path,
      ...(ALLOWED_FINAL_PATHS[test.path] ?? []),
    ].map(normalisePath);
    const landedRight =
      finalUrl.origin === BASE_ORIGIN &&
      permitted.includes(normalisePath(finalUrl.pathname));

    // Identity check for HTML pages only.
    let identityOk = true;
    let identityNote = null;
    if (test.isHome || test.distinctFromHome) {
      const html = await res.text();
      const title = titleOf(html);

      if (test.isHome) {
        homeTitle = title;
        if (!title) {
          identityOk = false;
          identityNote = 'homepage served no <title>; cannot identify pages';
        }
      } else {
        if (!title) {
          identityOk = false;
          identityNote = 'no <title> in response';
        } else if (homeTitle === null) {
          // Fail closed: without the baseline this check cannot run, and a
          // check that silently skips is the defect this file keeps finding.
          identityOk = false;
          identityNote =
            'homepage baseline unavailable; cannot verify identity';
        } else if (title === homeTitle) {
          identityOk = false;
          identityNote = `served the homepage document (title "${title}")`;
        }
      }
    }

    return {
      pass: statusOk && landedRight && identityOk,
      status: res.status,
      latency,
      error: null,
      landedAt: landedRight ? null : `${finalUrl.origin}${finalUrl.pathname}`,
      identityNote,
    };
  } catch (err) {
    return {
      pass: false,
      status: 0,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

const label = (method, path) => `${method} ${path}`.padEnd(36);

console.log(`\nSynthex Smoke Test \u2014 ${BASE_URL}`);
console.log('\u2500'.repeat(50));

let passed = 0;
for (const test of tests) {
  const result = await runTest(test);
  if (result.pass) passed++;
  const icon = result.pass ? '\u2713' : '\u2717';
  const status = result.error ? `ERR: ${result.error}` : String(result.status);
  const landed = result.landedAt
    ? `  -> landed at ${result.landedAt}`
    : result.identityNote
      ? `  -> ${result.identityNote}`
      : '';
  console.log(
    `${icon}  ${label(test.method, test.path)} ${status.padEnd(5)} (${result.latency}ms)${landed}`
  );
}

console.log('\u2500'.repeat(50));
console.log(`${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
