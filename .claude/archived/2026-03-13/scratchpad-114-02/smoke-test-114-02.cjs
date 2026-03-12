/**
 * Phase 114-02 Smoke Test
 * Usage: node .claude/scratchpad/smoke-test-114-02.cjs [baseUrl]
 * Default: https://synthex.social
 */

const baseUrl = process.argv[2] || 'https://synthex.social';
const TIMEOUT = 15000;

const endpoints = [
  '/api/ping',
  '/api/health/live',
  '/api/health/ready',
  '/api/health',
];

async function testEndpoint(url) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const ms = Date.now() - start;
    const body = await res.text().catch(() => '');
    return { ok: res.status < 500, status: res.status, ms, body: body.slice(0, 120) };
  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const reason = err.name === 'AbortError' ? `TIMEOUT ${ms}ms` : err.message;
    return { ok: false, status: 0, ms, body: reason };
  }
}

(async () => {
  console.log(`\nTesting ${baseUrl}\n${'─'.repeat(60)}`);
  let passed = 0;
  for (const path of endpoints) {
    const result = await testEndpoint(baseUrl + path);
    const icon = result.ok ? '✓' : '✗';
    const label = result.ok ? `${result.status} ${result.ms}ms` : result.body;
    console.log(`  ${icon} ${path.padEnd(28)} ${label}`);
    if (result.ok) passed++;
  }
  console.log(`\n${passed}/${endpoints.length} passed`);
  process.exit(passed === endpoints.length ? 0 : 1);
})();
