const { execSync } = require('child_process');
const DEPLOY = 'synthex-g3yy0x8rf';
const URL = `https://${DEPLOY}-unite-group.vercel.app`;

function sleep(s) { return new Promise(r => setTimeout(r, s * 1000)); }

(async () => {
  process.stdout.write(`Waiting for ${DEPLOY} to be Ready...\n`);
  for (let i = 0; i < 30; i++) {
    try {
      const out = execSync('vercel ls 2>&1', { cwd: 'D:/Synthex', encoding: 'utf8' });
      const line = out.split('\n').find(l => l.includes(DEPLOY));
      if (line) {
        process.stdout.write(`  [${i*15}s] ${line.trim()}\n`);
        if (line.includes('Ready')) {
          process.stdout.write('\nReady! Smoke testing...\n\n');
          try {
            const r = execSync(`node D:/Synthex/.claude/scratchpad/smoke-test-114-02.cjs ${URL}`, { encoding: 'utf8', timeout: 120000 });
            process.stdout.write(r);
          } catch (e) { process.stdout.write(e.stdout || ''); process.stdout.write(e.stderr || ''); }
          return;
        }
        if (line.includes('Error')) { process.stdout.write('BUILD FAILED\n'); process.exit(1); }
      }
    } catch (e) { process.stdout.write(`  poll error\n`); }
    await sleep(15);
  }
  process.stdout.write('Timed out\n');
})();
