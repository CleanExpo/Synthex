#!/usr/bin/env node
// scripts/smoke-test.mjs — Smoke test suite for live Synthex deployment
// Usage: BASE_URL=https://synthex.social node scripts/smoke-test.mjs
// Exit 0 = all pass, Exit 1 = any fail

const BASE_URL = process.env.BASE_URL || 'https://synthex.social';
const TIMEOUT_MS = 10000;

const tests = [
  { method: 'GET', path: '/api/health', acceptStatus: [200, 503] },
  { method: 'GET', path: '/api/health/live', acceptStatus: [200] },
  { method: 'GET', path: '/api/health/ready', acceptStatus: [200, 503] },
  { method: 'GET', path: '/', acceptStatus: [200] },
  { method: 'GET', path: '/login', acceptStatus: [200] },
  { method: 'GET', path: '/pricing', acceptStatus: [200] },
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

    return {
      pass: statusOk && landedRight,
      status: res.status,
      latency,
      error: null,
      landedAt: landedRight ? null : `${finalUrl.origin}${finalUrl.pathname}`,
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
  const landed = result.landedAt ? `  -> landed at ${result.landedAt}` : '';
  console.log(
    `${icon}  ${label(test.method, test.path)} ${status.padEnd(5)} (${result.latency}ms)${landed}`
  );
}

console.log('\u2500'.repeat(50));
console.log(`${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
