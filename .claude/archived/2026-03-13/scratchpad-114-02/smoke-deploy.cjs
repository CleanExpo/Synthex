const https = require('https');

const DEPLOY = process.argv[2] || 'synthex-8athva6yq-unite-group.vercel.app';

const PATHS = [
  '/api/health/live',
  '/api/health/ready',
  '/api/health',
];

function checkUrl(hostname, path) {
  return new Promise((resolve) => {
    const t = Date.now();
    const options = { hostname, path, timeout: 20000 };
    const req = https.get(options, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        const ms = Date.now() - t;
        const ok = r.statusCode < 400 && ms < 8000;
        resolve({ path, status: r.statusCode, ms, ok, body: d.slice(0, 120) });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ path, status: 0, ms: Date.now() - t, ok: false, body: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ path, status: 0, ms: Date.now() - t, ok: false, body: e.message }));
  });
}

async function run() {
  console.log(`\n[${new Date().toISOString()}] Testing https://${DEPLOY}`);
  const results = await Promise.all(PATHS.map(p => checkUrl(DEPLOY, p)));
  let pass = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon}  ${r.path.padEnd(20)}  HTTP ${String(r.status).padEnd(3)}  ${String(r.ms).padEnd(7)}ms  ${r.body}`);
    if (r.ok) pass++;
  }
  console.log(`\n${pass}/${PATHS.length} passed`);
  process.exit(pass === PATHS.length ? 0 : 1);
}

run();
