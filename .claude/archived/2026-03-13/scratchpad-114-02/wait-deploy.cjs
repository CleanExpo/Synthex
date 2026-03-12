const { execSync } = require('child_process');
const https = require('https');

function getLatest() {
  try {
    const out = execSync('vercel ls 2>&1', {
      cwd: 'D:\\Synthex',
      encoding: 'utf8',
      timeout: 15000,
    });
    const lines = out.split('\n');
    // Find first Ready deployment URL
    for (const line of lines) {
      const m = line.match(/https:\/\/(synthex-\w+-unite-group\.vercel\.app)/);
      if (m && line.includes('Ready') && line.includes('Production')) {
        return m[1];
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}

function test(host, path) {
  return new Promise((res) => {
    const t = Date.now();
    const req = https.get({ hostname: host, path, timeout: 15000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res({ path, status: r.statusCode, ms: Date.now() - t, body: d.slice(0, 80) }));
    });
    req.on('timeout', () => { req.destroy(); res({ path, status: 'TIMEOUT', ms: Date.now() - t }); });
    req.on('error', (e) => res({ path, status: 'ERR', err: e.message, ms: Date.now() - t }));
  });
}

async function waitAndTest() {
  const KNOWN = 'synthex-kssu2l67k-unite-group.vercel.app';
  let newHost = null;
  let attempts = 0;

  console.log('Waiting for new deployment after e3f3b682...');
  while (attempts < 30) {
    await new Promise(r => setTimeout(r, 10000));
    attempts++;
    const latest = getLatest();
    if (latest && latest !== KNOWN) {
      newHost = latest;
      console.log(`\nNew deployment: ${newHost} (found after ${attempts * 10}s)`);
      break;
    }
    process.stdout.write('.');
  }

  if (!newHost) {
    console.log('\nDeployment not detected — testing known latest anyway');
    newHost = KNOWN;
  }

  console.log('\nRunning smoke tests...');
  const paths = ['/api/ping', '/api/health/live', '/api/health/ready', '/api/health'];
  const results = await Promise.all(paths.map(p => test(newHost, p)));
  results.forEach(r => {
    const ok = r.status === 200 ? '✓' : '✗';
    console.log(`  ${ok} ${r.status} ${r.ms}ms ${r.path}`);
    if (r.body) console.log(`     ${r.body}`);
    if (r.err) console.log(`     ERR: ${r.err}`);
  });
}

waitAndTest().catch(console.error);
