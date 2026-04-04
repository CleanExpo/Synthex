const https = require('https');

const tests = [
  { url: 'https://synthex.social/', label: 'GET /' },
  { url: 'https://synthex.social/login', label: 'GET /login' },
  { url: 'https://synthex.social/pricing', label: 'GET /pricing' },
  { url: 'https://synthex.social/api/health', label: 'GET /api/health' },
  { url: 'https://synthex.social/api/health/live', label: 'GET /api/health/live' },
  { url: 'https://synthex.social/api/health/ready', label: 'GET /api/health/ready' },
];

let passed = 0, failed = 0;

function run([test, ...rest]) {
  if (!test) {
    console.log('\n=== SMOKE TEST RESULTS ===');
    console.log('Passed: ' + passed + '/' + (passed + failed));
    if (failed === 0) console.log('STATUS: ALL PASS — Phase 114-02 COMPLETE');
    else console.log('STATUS: ' + failed + ' FAILING');
    return;
  }
  const start = Date.now();
  const req = https.get(test.url, { timeout: 12000 }, (res) => {
    const ms = Date.now() - start;
    const ok = res.statusCode >= 200 && res.statusCode < 400;
    if (ok) { passed++; console.log('PASS  ' + test.label + '  ' + res.statusCode + '  ' + ms + 'ms'); }
    else     { failed++; console.log('FAIL  ' + test.label + '  ' + res.statusCode + '  ' + ms + 'ms'); }
    res.resume();
    run(rest);
  });
  req.on('timeout', () => {
    failed++;
    console.log('FAIL  ' + test.label + '  TIMEOUT (>12s)');
    req.destroy();
    run(rest);
  });
  req.on('error', (e) => {
    failed++;
    console.log('FAIL  ' + test.label + '  ERROR: ' + e.message);
    run(rest);
  });
}

run(tests);
