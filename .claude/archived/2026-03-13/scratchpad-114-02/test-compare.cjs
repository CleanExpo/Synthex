const https = require('https');

// Test routes that work vs routes that hang
const BASE = 'https://synthex-kssu2l67k-unite-group.vercel.app';
const routes = [
  '/api/health/live',           // hangs - simple route, only NextResponse
  '/api/health/ready',          // hangs
  '/api/health',                // hangs
  '/api/cron/publish-scheduled', // has worked before (needs CRON_SECRET)
];

function test(path) {
  const url = `${BASE}${path}`;
  const headers = path.includes('cron')
    ? { Authorization: `Bearer ${process.env.CRON_SECRET || 'test'}` }
    : {};

  return new Promise((res) => {
    const t = Date.now();
    const req = https.get({ hostname: new URL(url).hostname, path, headers, timeout: 12000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () =>
        res({ path, status: r.statusCode, ms: Date.now() - t, body: d.slice(0, 120) })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      res({ path, status: 'TIMEOUT', ms: Date.now() - t });
    });
    req.on('error', (e) =>
      res({ path, status: 'ERR', err: e.message, ms: Date.now() - t })
    );
  });
}

Promise.all(routes.map(test)).then((results) => {
  results.forEach((r) => {
    const ok = r.status === 200 || r.status === 401 ? '✓' : '✗';
    console.log(`${ok} ${r.status} ${r.ms}ms ${r.path}`);
    if (r.body) console.log(`   ${r.body}`);
    if (r.err) console.log(`   ERR: ${r.err}`);
  });
});
