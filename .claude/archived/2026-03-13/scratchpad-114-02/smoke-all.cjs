const https = require('https');

const deployments = [
  'synthex-kssu2l67k-unite-group.vercel.app',
  'synthex-5309vbf8s-unite-group.vercel.app',
  'synthex.social',
];

const paths = ['/api/health/live', '/api/health/ready', '/api/health'];

function test(host, path) {
  const url = `https://${host}${path}`;
  return new Promise((res) => {
    const t = Date.now();
    const req = https.get(url, { timeout: 20000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () =>
        res({ host, path, status: r.statusCode, ms: Date.now() - t, body: d.slice(0, 100) })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      res({ host, path, status: 'TIMEOUT', ms: Date.now() - t });
    });
    req.on('error', (e) =>
      res({ host, path, status: 'ERR', err: e.message, ms: Date.now() - t })
    );
  });
}

const jobs = [];
for (const host of deployments) {
  for (const path of paths) {
    jobs.push(test(host, path));
  }
}

Promise.all(jobs).then((results) => {
  // Group by host
  for (const host of deployments) {
    console.log(`\n== ${host} ==`);
    results
      .filter((r) => r.host === host)
      .forEach((r) => {
        const ok = r.status === 200 ? '✓' : '✗';
        console.log(`  ${ok} ${r.status} ${r.ms}ms ${r.path}`);
        if (r.body && r.status !== 200) console.log(`    ${r.body}`);
        if (r.err) console.log(`    ERR: ${r.err}`);
      });
  }
});
