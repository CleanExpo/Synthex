const https = require('https');

const HOST = process.argv[2] || 'synthex-rntbqnsq1-unite-group.vercel.app';
const TIMEOUT_MS = 35000;

const PATHS = ['/api/health/live', '/api/health/ready', '/api/health'];

function check(hostname, path) {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get({ hostname, path, timeout: TIMEOUT_MS }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        const ms = Date.now() - t;
        resolve({ path, status: r.statusCode, ms, body: d.slice(0, 120) });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ path, status: 0, ms: Date.now() - t, body: 'TIMEOUT' }); });
    req.on('error', e => resolve({ path, status: 0, ms: Date.now() - t, body: e.message }));
  });
}

async function run() {
  // First call — cold start
  console.log(`\n[COLD] ${new Date().toISOString()} — ${HOST}`);
  const cold = await Promise.all(PATHS.map(p => check(HOST, p)));
  for (const r of cold) {
    const ok = r.status > 0 && r.status < 400;
    console.log(`${ok ? '✅' : '❌'}  ${r.path.padEnd(20)}  ${r.status}  ${r.ms}ms  ${r.body}`);
  }

  // Second call — warm (1s later)
  await new Promise(r => setTimeout(r, 1000));
  console.log(`\n[WARM] ${new Date().toISOString()}`);
  const warm = await Promise.all(PATHS.map(p => check(HOST, p)));
  for (const r of warm) {
    const ok = r.status > 0 && r.status < 400;
    console.log(`${ok ? '✅' : '❌'}  ${r.path.padEnd(20)}  ${r.status}  ${r.ms}ms  ${r.body}`);
  }
}

run();
