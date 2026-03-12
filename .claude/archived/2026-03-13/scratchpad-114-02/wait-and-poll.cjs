const https = require('https');

const URLS = [
  'https://synthex.social/api/health/live',
  'https://synthex.social/api/health/ready',
  'https://synthex.social/api/health',
];

function checkUrl(url) {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get(url, { timeout: 20000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        const ms = Date.now() - t;
        const ok = r.statusCode < 400 && ms < 8000;
        resolve({ url, status: r.statusCode, ms, ok, body: d.slice(0, 120) });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ms: Date.now() - t, ok: false, body: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ url, status: 0, ms: Date.now() - t, ok: false, body: e.message }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const START = Date.now();
  const WAIT_BEFORE_FIRST_CHECK_MS = 4 * 60 * 1000; // 4 min — build takes ~5 min total, 1 min elapsed

  console.log(`Waiting ${WAIT_BEFORE_FIRST_CHECK_MS / 1000}s for Vercel build to complete...`);
  await sleep(WAIT_BEFORE_FIRST_CHECK_MS);

  for (let attempt = 1; attempt <= 6; attempt++) {
    console.log(`\n--- Attempt ${attempt} at T+${Math.round((Date.now() - START) / 1000)}s [${new Date().toISOString()}] ---`);
    const results = await Promise.all(URLS.map(checkUrl));
    let pass = 0;
    for (const r of results) {
      const icon = r.ok ? '✅' : '❌';
      console.log(`${icon} ${r.url.split('/').pop().padEnd(7)}  HTTP ${String(r.status).padEnd(3)}  ${String(r.ms).padEnd(6)}ms  ${r.body}`);
      if (r.ok) pass++;
    }
    console.log(`\n${pass}/${URLS.length} passed`);

    if (pass === URLS.length) {
      console.log('\n🎉 ALL HEALTH ENDPOINTS PASS — cold-start fix confirmed!');
      process.exit(0);
    }

    // If all are timeouts, build may still be deploying — wait and retry
    const allTimeout = results.every(r => r.body === 'TIMEOUT');
    if (allTimeout && attempt < 6) {
      console.log('All timed out — waiting 90s before retry...');
      await sleep(90000);
    } else if (attempt < 6) {
      console.log('Waiting 60s before retry...');
      await sleep(60000);
    }
  }

  console.log('\n❌ Smoke test FAILED after 6 attempts');
  process.exit(1);
}

run();
