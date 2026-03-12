/**
 * Phase 114-02 smoke test — health endpoint timing
 * Run: node .claude/scratchpad/smoke-114.cjs
 */
const https = require('https');

const BASE = 'https://synthex.social';
const TIMEOUT_MS = 12000;

const ENDPOINTS = [
  { path: '/api/health/live',  expect: 200 },
  { path: '/api/health/ready', expect: 200 },
  { path: '/api/health',       expect: 200 },
];

function get(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode, ms: Date.now() - start, body: body.slice(0, 120) });
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message, ms: Date.now() - start }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'TIMEOUT', ms: Date.now() - start });
    });
    req.setTimeout(TIMEOUT_MS);
  });
}

async function run() {
  console.log(`\nPhase 114-02 Smoke Test — ${new Date().toISOString()}`);
  console.log(`Target: ${BASE}\n`);

  let pass = 0, fail = 0;

  for (const ep of ENDPOINTS) {
    const url = BASE + ep.path;
    process.stdout.write(`  ${ep.path.padEnd(22)} ... `);
    const r = await get(url);
    const ok = r.ok && r.status === ep.expect && r.ms < 8000;
    const tag = ok ? 'PASS' : 'FAIL';
    console.log(`${tag}  ${r.status || 'ERR'}  ${r.ms}ms  ${r.error || ''}${r.body || ''}`);
    ok ? pass++ : fail++;
    // Warm up second hit
    const r2 = await get(url);
    const ok2 = r2.ok && r2.status === ep.expect && r2.ms < 3000;
    console.log(`  ${'(warm)'.padEnd(22)} ... ${ok2 ? 'PASS' : 'WARN'}  ${r2.status || 'ERR'}  ${r2.ms}ms`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Result: ${pass}/${ENDPOINTS.length} cold hits passed`);
  console.log(`Phase 114-02: ${pass === ENDPOINTS.length ? '✅ DONE — all health endpoints fast' : '❌ STILL HANGING'}`);
}

run().catch(console.error);
