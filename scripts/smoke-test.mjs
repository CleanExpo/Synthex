#!/usr/bin/env node
// scripts/smoke-test.mjs — Smoke test suite for live Synthex deployment
// Usage: BASE_URL=https://synthex.social node scripts/smoke-test.mjs
// Exit 0 = all pass, Exit 1 = any fail

const BASE_URL = process.env.BASE_URL || 'https://synthex.social';
const TIMEOUT_MS = 10000;

const tests = [
  { method: 'GET',  path: '/api/health',       acceptStatus: [200, 503] },
  { method: 'GET',  path: '/api/health/live',  acceptStatus: [200] },
  { method: 'GET',  path: '/api/health/ready', acceptStatus: [200, 503] },
  { method: 'GET',  path: '/',                 acceptStatus: [200] },
  { method: 'GET',  path: '/login',            acceptStatus: [200] },
  { method: 'GET',  path: '/pricing',          acceptStatus: [200] },
  { method: 'HEAD', path: '/api/health',       acceptStatus: [200] },
];

async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: test.method, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const pass = test.acceptStatus.includes(res.status);
    return { pass, status: res.status, latency, error: null };
  } catch (err) {
    return { pass: false, status: 0, latency: Date.now() - start, error: err.message };
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
  console.log(`${icon}  ${label(test.method, test.path)} ${status.padEnd(5)} (${result.latency}ms)`);
}

console.log('\u2500'.repeat(50));
console.log(`${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
