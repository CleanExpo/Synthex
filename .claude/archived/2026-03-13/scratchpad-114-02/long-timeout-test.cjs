/**
 * Test with 60s timeout to see if Lambda eventually responds
 */
const BASE = process.argv[2] || 'https://synthex-g3yy0x8rf-unite-group.vercel.app';

async function test(path, timeout) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, { signal: controller.signal });
    clearTimeout(t);
    const body = await res.text();
    return { ok: true, status: res.status, ms: Date.now() - start, body: body.slice(0, 200) };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, ms: Date.now() - start, err: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  }
}

(async () => {
  console.log(`Testing ${BASE} with 60s timeout\n`);

  const paths = ['/api/ping', '/api/health/live'];
  for (const p of paths) {
    process.stdout.write(`  ${p} ... `);
    const r = await test(p, 60000);
    if (r.ok) {
      console.log(`${r.status} in ${r.ms}ms — ${r.body}`);
    } else {
      console.log(`${r.err} after ${r.ms}ms`);
    }
  }
})();
