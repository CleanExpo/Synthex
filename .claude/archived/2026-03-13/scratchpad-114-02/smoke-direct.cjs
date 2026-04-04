/**
 * Smoke test against specific deployment URL to bypass caching
 */
const https = require('https');
const TIMEOUT_MS = 15000;

const TARGETS = [
  'https://synthex-elbseexol-unite-group.vercel.app',
  'https://synthex.social',
];

const PATHS = ['/api/health/live', '/api/health/ready', '/api/health'];

function get(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode, ms: Date.now() - start, body: body.slice(0, 80) });
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message, ms: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'TIMEOUT', ms: Date.now() - start }); });
    req.setTimeout(TIMEOUT_MS);
  });
}

async function run() {
  for (const base of TARGETS) {
    console.log(`\n--- ${base} ---`);
    for (const path of PATHS) {
      const r = await get(base + path);
      console.log(`  ${path.padEnd(20)} ${r.status || 'ERR'} ${r.ms}ms  ${r.error || r.body}`);
    }
  }
}
run().catch(console.error);
