const { execSync } = require('child_process');
const https = require('https');

const DEPLOY = 'synthex-5309vbf8s-unite-group.vercel.app';
const PATHS = ['/api/health/live', '/api/health/ready', '/api/health'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isReady() {
  try {
    const out = execSync('vercel ls 2>&1', { encoding: 'utf8', timeout: 10000 });
    const line = out.split('\n').find(l => l.includes('synthex-5309vbf8s'));
    if (line && line.includes('Ready')) return true;
    if (line && line.includes('Error')) { console.log('Deploy ERRORED:', line); process.exit(2); }
    return false;
  } catch { return false; }
}

function check(path) {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get({ hostname: DEPLOY, path, timeout: 20000 }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ path, status: r.statusCode, ms: Date.now()-t, body: d.slice(0,120) }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ path, status: 0, ms: Date.now()-t, body: 'TIMEOUT' }); });
    req.on('error', e => resolve({ path, status: 0, ms: Date.now()-t, body: e.message }));
  });
}

async function run() {
  // Poll until Ready (max 8 min)
  let ready = false;
  for (let i = 0; i < 48; i++) {
    await sleep(10000);
    if (isReady()) { ready = true; break; }
    process.stdout.write('.');
  }
  if (!ready) { console.log('\nDeployment never became Ready'); process.exit(1); }
  console.log(`\n\n✅ ${DEPLOY} is Ready — running smoke test...`);

  // Cold test
  console.log(`\n[COLD] ${new Date().toISOString()}`);
  const results = await Promise.all(PATHS.map(check));
  let pass = 0;
  for (const r of results) {
    const ok = r.status > 0 && r.status < 400 && r.ms < 15000;
    console.log(`${ok?'✅':'❌'}  ${r.path.padEnd(22)} HTTP ${r.status}  ${r.ms}ms  ${r.body}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${PATHS.length} cold requests passed`);

  // Warm test (2s later)
  await sleep(2000);
  console.log(`\n[WARM] ${new Date().toISOString()}`);
  const warm = await Promise.all(PATHS.map(check));
  let wpass = 0;
  for (const r of warm) {
    const ok = r.status > 0 && r.status < 400 && r.ms < 5000;
    console.log(`${ok?'✅':'❌'}  ${r.path.padEnd(22)} HTTP ${r.status}  ${r.ms}ms  ${r.body}`);
    if (ok) wpass++;
  }
  console.log(`\n${wpass}/${PATHS.length} warm requests passed`);
  process.exit(pass + wpass === PATHS.length * 2 ? 0 : 1);
}

run();
