const https = require('https');
const HOST = 'synthex-go2kbm1w8-unite-group.vercel.app';
const paths = ['/api/ping', '/api/health/live', '/api/health/ready', '/api/health'];

function test(path) {
  return new Promise((res) => {
    const t = Date.now();
    const req = https.get({ hostname: HOST, path, timeout: 20000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res({ path, status: r.statusCode, ms: Date.now() - t, body: d.slice(0, 120) }));
    });
    req.on('timeout', () => { req.destroy(); res({ path, status: 'TIMEOUT', ms: Date.now() - t }); });
    req.on('error', (e) => res({ path, status: 'ERR', err: e.message, ms: Date.now() - t }));
  });
}

console.log(`Testing https://${HOST}`);
Promise.all(paths.map(test)).then(results => {
  let pass = 0;
  results.forEach(r => {
    const ok = r.status === 200;
    if (ok) pass++;
    console.log(`  ${ok ? '✓' : '✗'} ${r.status} ${r.ms}ms ${r.path}`);
    if (r.body && r.status !== 200) console.log(`     ${r.body}`);
    if (r.err) console.log(`     ERR: ${r.err}`);
  });
  console.log(`\n${pass}/${results.length} passed`);
});
