const https = require('https');

const URLS = [
  'https://synthex.social/api/health/live',
  'https://synthex.social/api/health/ready',
  'https://synthex.social/api/health',
];

function checkUrl(url) {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get(url, { timeout: 20000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        const ms = Date.now() - t;
        const ok = r.statusCode < 400 && ms < 8000;
        resolve({ url, status: r.statusCode, ms, ok, body: d.slice(0, 100) });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ms: Date.now() - t, ok: false, body: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ url, status: 0, ms: Date.now() - t, ok: false, body: e.message }));
  });
}

async function run() {
  console.log(`\n[${new Date().toISOString()}] Checking health endpoints...`);
  const results = await Promise.all(URLS.map(checkUrl));
  let pass = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.url.split('/').slice(-1)[0].padEnd(7)} HTTP ${r.status} ${r.ms}ms  ${r.body}`);
    if (r.ok) pass++;
  }
  console.log(`\n${pass}/${URLS.length} passed\n`);
  return pass === URLS.length;
}

run().then((ok) => process.exit(ok ? 0 : 1));
