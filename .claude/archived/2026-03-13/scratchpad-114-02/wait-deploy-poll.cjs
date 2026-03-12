/**
 * Poll vercel ls until the newest deployment is Ready, then run smoke test.
 */
const { execSync } = require('child_process');
const DEPLOY_URL = 'https://synthex-awc37pvcy-unite-group.vercel.app';
const MAX_WAIT = 360; // 6 minutes
const INTERVAL = 15; // seconds

let elapsed = 0;
process.stdout.write(`Waiting for ${DEPLOY_URL} to be Ready...\n`);

function check() {
  try {
    const out = execSync('vercel ls 2>&1', { cwd: 'D:/Synthex', encoding: 'utf8' });
    const line = out.split('\n').find(l => l.includes('awc37pvcy'));
    if (line) {
      process.stdout.write(`  [${elapsed}s] ${line.trim()}\n`);
      if (line.includes('● Ready')) return true;
      if (line.includes('● Error')) { process.stdout.write('BUILD FAILED\n'); process.exit(1); }
    }
  } catch (e) { process.stdout.write(`  [${elapsed}s] poll error: ${e.message}\n`); }
  return false;
}

function sleep(s) { return new Promise(r => setTimeout(r, s * 1000)); }

(async () => {
  while (elapsed < MAX_WAIT) {
    if (check()) {
      process.stdout.write('\nDeployment ready! Running smoke test...\n\n');
      // Run smoke test
      try {
        const result = execSync(`node D:/Synthex/.claude/scratchpad/smoke-test-114-02.cjs ${DEPLOY_URL}`, { encoding: 'utf8', timeout: 120000 });
        process.stdout.write(result);
      } catch (e) {
        process.stdout.write(e.stdout || '');
        process.stdout.write(e.stderr || '');
      }
      return;
    }
    await sleep(INTERVAL);
    elapsed += INTERVAL;
  }
  process.stdout.write(`Timed out after ${MAX_WAIT}s\n`);
})();
