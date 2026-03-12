/**
 * Diagnostic: test 404 (edge), cron auth (cold), and health routes
 * Usage: node diag-routes.cjs [baseUrl]
 */
const BASE = process.argv[2] || 'https://synthex-j23wgr988-unite-group.vercel.app';
const TIMEOUT = 12000;

const tests = [
  // Edge 404 - no Lambda, just Vercel routing
  { url: '/api/nonexistent-route-for-diag', label: '404 edge (no lambda)' },
  // Ping - zero imports Lambda
  { url: '/api/ping', label: 'ping (zero imports)' },
  // Health live - only NextResponse import
  { url: '/api/health/live', label: 'health/live (nextresponse only)' },
  // Cron auth - Lambda that responds (warm)
  { url: '/api/cron/publish-scheduled', label: 'cron/publish-scheduled (warm?)' },
  // Another simple route that might be cold
  { url: '/api/cron/welcome-sequence', label: 'cron/welcome-sequence (cold?)' },
];

async function test(path, label) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, { signal: controller.signal });
    clearTimeout(t);
    return { ok: true, status: res.status, ms: Date.now() - start, label };
  } catch (e) {
    clearTimeout(t);
    const ms = Date.now() - start;
    return { ok: false, status: 0, ms, label, err: e.name === 'AbortError' ? `TIMEOUT ${ms}ms` : e.message };
  }
}

(async () => {
  console.log(`Testing ${BASE}\n`);
  for (const t of tests) {
    const r = await test(t.url, t.label);
    const icon = r.ok ? '✓' : '✗';
    console.log(`  ${icon} ${r.label.padEnd(38)} ${r.ok ? `${r.status} ${r.ms}ms` : r.err}`);
  }
})();
