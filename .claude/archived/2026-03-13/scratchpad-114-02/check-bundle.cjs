const https = require('https');

// Fetch the source map to check if Sentry is still injected
// Alternatively, just hit the route and check timing
const tests = [
  'https://synthex-1z7dye4cq-unite-group.vercel.app/api/health/live',
  'https://synthex.social/api/health/live',
];

tests.forEach(url => {
  const start = Date.now();
  const req = https.get(url, { timeout: 15000 }, res => {
    const ms = Date.now() - start;
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log(`${res.statusCode} ${ms}ms ${url}`);
      try { console.log('  body:', body.slice(0, 200)); } catch(e) {}
    });
  });
  req.on('timeout', () => { console.log(`TIMEOUT ${Date.now()-start}ms ${url}`); req.destroy(); });
  req.on('error', e => console.log(`ERROR ${e.message} ${url}`));
});
