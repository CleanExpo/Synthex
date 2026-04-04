const https = require('https');

function check(host, path) {
  const t = Date.now();
  const req = https.get(
    { host, path, headers: { 'User-Agent': 'smoke-test', 'x-vercel-skip-toolbar': '1' } },
    (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () =>
        console.log(`[${host}] ${path} -> ${res.statusCode} ${Date.now() - t}ms | ${d.substring(0, 150)}`)
      );
    }
  );
  req.on('error', (e) => console.log(`[${host}] ${path} ERROR ${e.message} ${Date.now() - t}ms`));
  req.setTimeout(12000, () => {
    console.log(`[${host}] ${path} TIMEOUT ${Date.now() - t}ms`);
    req.destroy();
  });
}

// Test both the new build URL and production
const newBuild = 'synthex-ei7m4qlen-unite-group.vercel.app';
const prod = 'synthex.social';

check(newBuild, '/api/health/live');
check(prod, '/api/health/live');
