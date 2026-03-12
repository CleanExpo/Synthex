const https = require('https');

// Test against the new deployment URL directly
const BASE = 'synthex-1z7dye4cq-unite-group.vercel.app';

const tests = [
  { url: `https://${BASE}/`, label: 'GET /' },
  { url: `https://${BASE}/login`, label: 'GET /login' },
  { url: `https://${BASE}/pricing`, label: 'GET /pricing' },
  { url: `https://${BASE}/api/health/live`, label: 'GET /api/health/live' },
  { url: `https://${BASE}/api/health/ready`, label: 'GET /api/health/ready' },
  { url: `https://${BASE}/api/health`, label: 'GET /api/health' },
  { url: `https://synthex.social/api/health/live`, label: 'GET synthex.social/api/health/live' },
];

let passed = 0, failed = 0, done = 0;

function run(test) {
  const start = Date.now();
  const req = https.get(test.url, { timeout: 12000 }, (res) => {
    const ms = Date.now() - start;
    const ok = res.statusCode >= 200 && res.statusCode < 400;
    if (ok) { passed++; console.log('PASS  ' + test.label + '  ' + res.statusCode + '  ' + ms + 'ms'); }
    else     { failed++; console.log('FAIL  ' + test.label + '  ' + res.statusCode + '  ' + ms + 'ms'); }
    res.resume();
    check();
  });
  req.on('timeout', () => {
    failed++;
    console.log('FAIL  ' + test.label + '  TIMEOUT (>12s)');
    req.destroy();
    check();
  });
  req.on('error', (e) => {
    // Only count error if we haven't already counted timeout
    if (!e.message.includes('socket hang up') || ms === undefined) {
      failed++;
      console.log('FAIL  ' + test.label + '  ERROR: ' + e.message);
    }
    check();
  });
}

function check() {
  done++;
  if (done >= tests.length) {
    console.log('\n=== SMOKE TEST RESULTS ===');
    console.log('Passed: ' + passed + '/' + tests.length);
    if (failed === 0) console.log('STATUS: ALL PASS — Phase 114-02 COMPLETE ✓');
    else console.log('STATUS: ' + failed + ' FAILING');
  }
}

// Run all in parallel for speed
tests.forEach(run);
