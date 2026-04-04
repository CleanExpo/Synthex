const https = require('https');

const BASE = 'https://synthex-5309vbf8s-unite-group.vercel.app';
const PROD = 'https://synthex.social';

const endpoints = [
  `${BASE}/api/health/live`,
  `${BASE}/api/health/ready`,
  `${BASE}/api/health`,
  `${PROD}/api/health/live`,
  `${PROD}/api/health/ready`,
  `${PROD}/api/health`,
];

function test(url) {
  return new Promise((res) => {
    const t = Date.now();
    const req = https.get(url, { timeout: 15000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () =>
        res({ url, status: r.statusCode, ms: Date.now() - t, body: d.slice(0, 150) })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      res({ url, status: 'TIMEOUT', ms: Date.now() - t });
    });
    req.on('error', (e) =>
      res({ url, status: 'ERR', err: e.message, ms: Date.now() - t })
    );
  });
}

Promise.all(endpoints.map(test)).then((results) => {
  results.forEach((x) => {
    const label = x.url.includes('synthex.social') ? '[PROD]' : '[DEPLOY]';
    const path = x.url.replace(/^https:\/\/[^/]+/, '');
    console.log(`${label} ${x.status} ${x.ms}ms ${path}`);
    if (x.body) console.log('  ', x.body.replace(/\n/g, ' '));
    if (x.err) console.log('  ERR:', x.err);
  });
});
