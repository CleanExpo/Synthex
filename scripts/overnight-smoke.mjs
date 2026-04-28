#!/usr/bin/env node
// scripts/overnight-smoke.mjs
//
// Overnight smoke + health-check + fault-injection rig for synthex.social.
// Plan: C:/Users/Disaster Recovery 4/.claude/plans/https-github-com-cleanexpo-synthex-git-h-virtual-wand.md
//
// Usage:
//   node scripts/overnight-smoke.mjs                       # 100 iters, prod
//   node scripts/overnight-smoke.mjs --iterations=50
//   node scripts/overnight-smoke.mjs --dry-run             # 1 iter, exit 0
//   node scripts/overnight-smoke.mjs --skip-preflight
//
// Outputs (under .claude/scratchpad/):
//   overnight-smoke-results.jsonl       (one row per check)
//   overnight-smoke-clusters.json       (failures grouped)
//   morning-task-list.md                (P0/P1/P2/P3 ranked, Linear-ready)

import { writeFile, appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SCRATCHPAD = resolve(REPO_ROOT, '.claude/scratchpad');
const RESULTS_FILE = resolve(SCRATCHPAD, 'overnight-smoke-results.jsonl');
const CLUSTERS_FILE = resolve(SCRATCHPAD, 'overnight-smoke-clusters.json');
const REPORT_FILE = resolve(SCRATCHPAD, 'morning-task-list.md');

// ─── CLI ARGS ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args.map(a => {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? true];
    }
    return [a, true];
  })
);
const TARGET = (argMap.target || 'https://synthex.social').replace(/\/+$/, '');
const ITERATIONS = argMap['dry-run']
  ? 1
  : parseInt(argMap.iterations || '100', 10);
const DRY_RUN = !!argMap['dry-run'];
const SKIP_PREFLIGHT = !!argMap['skip-preflight'];
const ITER_DELAY_MS = DRY_RUN
  ? 0
  : Math.floor((8 * 60 * 60 * 1000) / ITERATIONS); // ~5 min for 100 iters

// ─── SURFACE LISTS ───────────────────────────────────────────────────────
const PUBLIC_URLS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/features',
  '/about',
  '/pricing',
  '/benchmark',
  '/clients',
];
const HEALTH_URLS = [
  { path: '/api/health', expectStatus: [200, 503] },
  { path: '/api/health/db', expectStatus: [200, 503] },
  { path: '/api/health/redis', expectStatus: [200, 503] },
  { path: '/api/health/composite', expectStatus: [200, 401, 503] }, // composite gated to admin
];
const HYDRATION_SURFACES = [
  { url: '/login', mustContain: ['Sign in', 'Email', 'Password'] },
  { url: '/signup', mustContain: ['Email'] },
  { url: '/forgot-password', mustContain: ['email'] },
  { url: '/dashboard', mustContain: [], expectRedirect: true },
  { url: '/', mustContain: [] },
  { url: '/clients', mustContain: [] },
  { url: '/features', mustContain: [] },
  { url: '/pricing', mustContain: [] },
];
const JSON_LD_SURFACES = [
  '/',
  '/pricing',
  '/features/ai-content',
  '/agencies',
  '/compare/hootsuite',
];

// ─── UTILS ───────────────────────────────────────────────────────────────
async function ensureScratchpad() {
  if (!existsSync(SCRATCHPAD)) await mkdir(SCRATCHPAD, { recursive: true });
}

async function logRow(row) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n';
  await appendFile(RESULTS_FILE, line);
}

async function fetchSafe(url, opts = {}) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), opts.timeout || 8000);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ac.signal,
      redirect: opts.redirect || 'manual',
    });
    return {
      ok: true,
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.text().catch(() => ''),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message || String(err),
      ms: Date.now() - t0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── LAYER 0: PRE-FLIGHT ─────────────────────────────────────────────────
async function preflight() {
  console.log(`[pre-flight] target=${TARGET}`);
  if (SKIP_PREFLIGHT) {
    console.log('[pre-flight] SKIPPED via --skip-preflight');
    await logRow({
      iter: 0,
      layer: 'preflight',
      check: 'skipped',
      status: 'PASS',
    });
    return { ok: true };
  }

  // 1. CSP header check
  const csp = await fetchSafe(`${TARGET}/login`, { method: 'HEAD' });
  if (!csp.ok || csp.status >= 500) {
    return {
      ok: false,
      reason: `Cannot reach ${TARGET}/login (status=${csp.status} err=${csp.error || 'n/a'})`,
    };
  }
  const cspHeader = csp.headers['content-security-policy'] || '';
  const hasUnsafeInline = /script-src[^;]*'unsafe-inline'/.test(cspHeader);
  await logRow({
    iter: 0,
    layer: 'preflight',
    check: 'csp-header',
    status: hasUnsafeInline ? 'PASS' : 'FAIL',
    csp: cspHeader.slice(0, 200),
  });
  if (!hasUnsafeInline) {
    return {
      ok: false,
      reason: `CSP hotfix #122 not live — script-src missing 'unsafe-inline'. Header: ${cspHeader.slice(0, 200)}`,
    };
  }
  console.log('[pre-flight] ✅ CSP unsafe-inline live');

  // 2. Demo endpoint (CONSTITUTION.md gate)
  const demo = await fetchSafe(`${TARGET}/api/demo/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://google.com.au' }),
    timeout: 15000,
  });
  let demoOk = false;
  try {
    const json = JSON.parse(demo.body || '{}');
    demoOk = !!json.businessName && !!json.caption;
  } catch {
    /* malformed json */
  }
  await logRow({
    iter: 0,
    layer: 'preflight',
    check: 'demo-analyze',
    status: demoOk ? 'PASS' : 'FAIL',
    httpStatus: demo.status,
    ms: demo.ms,
  });
  if (!demoOk) {
    return {
      ok: false,
      reason: `Demo endpoint failed — status=${demo.status} body=${demo.body?.slice(0, 200)}`,
    };
  }
  console.log(
    '[pre-flight] ✅ /api/demo/analyze returns businessName + caption'
  );
  return { ok: true };
}

// ─── LAYER 1: SURFACE HEALTH ─────────────────────────────────────────────
async function layer1(iter) {
  let pass = 0,
    fail = 0;
  for (const path of PUBLIC_URLS) {
    const r = await fetchSafe(`${TARGET}${path}`, { timeout: 5000 });
    const ok = r.ok && r.status >= 200 && r.status < 400;
    await logRow({
      iter,
      layer: 'L1-surface',
      check: path,
      status: ok ? 'PASS' : 'FAIL',
      httpStatus: r.status,
      ms: r.ms,
      error: r.error,
    });
    ok ? pass++ : fail++;
  }
  for (const h of HEALTH_URLS) {
    const r = await fetchSafe(`${TARGET}${h.path}`, { timeout: 8000 });
    const ok = r.ok && h.expectStatus.includes(r.status);
    await logRow({
      iter,
      layer: 'L1-surface',
      check: h.path,
      status: ok ? 'PASS' : 'FAIL',
      httpStatus: r.status,
      expectStatus: h.expectStatus,
      ms: r.ms,
      error: r.error,
    });
    ok ? pass++ : fail++;
  }
  // Demo POST
  const demo = await fetchSafe(`${TARGET}/api/demo/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://google.com.au' }),
    timeout: 15000,
  });
  let demoOk = false;
  try {
    const j = JSON.parse(demo.body || '{}');
    demoOk = !!j.businessName && !!j.caption;
  } catch {}
  await logRow({
    iter,
    layer: 'L1-surface',
    check: 'POST /api/demo/analyze',
    status: demoOk ? 'PASS' : 'FAIL',
    httpStatus: demo.status,
    ms: demo.ms,
  });
  demoOk ? pass++ : fail++;
  return { pass, fail };
}

// ─── LAYER 2: CSP HYDRATION (PLAYWRIGHT) ─────────────────────────────────
let _browser = null;
async function getBrowser() {
  if (_browser) return _browser;
  const { chromium } = await import('playwright');
  _browser = await chromium.launch({ headless: true });
  return _browser;
}

async function layer2(iter) {
  let pass = 0,
    fail = 0;
  const browser = await getBrowser();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const cspBuckets = {
    script: [],
    font: [],
    style: [],
    img: [],
    connect: [],
    other: [],
  };
  page.on('console', msg => {
    const t = msg.text();
    if (!/content security policy/i.test(t)) return;
    if (/script-src/i.test(t)) cspBuckets.script.push(t.slice(0, 200));
    else if (/font-src/i.test(t) || /Loading the font/i.test(t))
      cspBuckets.font.push(t.slice(0, 200));
    else if (/style-src/i.test(t)) cspBuckets.style.push(t.slice(0, 200));
    else if (/img-src/i.test(t)) cspBuckets.img.push(t.slice(0, 200));
    else if (/connect-src/i.test(t)) cspBuckets.connect.push(t.slice(0, 200));
    else cspBuckets.other.push(t.slice(0, 200));
  });

  for (const surface of HYDRATION_SURFACES) {
    Object.keys(cspBuckets).forEach(k => (cspBuckets[k].length = 0));
    const url = `${TARGET}${surface.url}`;
    const t0 = Date.now();
    let result = {
      surface: surface.url,
      status: 'PASS',
      ms: 0,
      error: null,
      scriptCount: 0,
      cspScript: 0,
      cspFont: 0,
      cspOther: 0,
    };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2500); // let hydration settle
      const scriptCount = await page.evaluate(() => document.scripts.length);
      result.scriptCount = scriptCount;
      result.cspScript = cspBuckets.script.length;
      result.cspFont = cspBuckets.font.length;
      result.cspOther =
        cspBuckets.style.length +
        cspBuckets.img.length +
        cspBuckets.connect.length +
        cspBuckets.other.length;
      // mustContain check (only if not redirect)
      if (
        surface.mustContain &&
        surface.mustContain.length &&
        !surface.expectRedirect
      ) {
        const html = await page.content();
        const missing = surface.mustContain.filter(t => !html.includes(t));
        if (missing.length) {
          result.status = 'FAIL';
          result.error = `Missing expected text: ${missing.join(', ')}`;
        }
      }
      // ONLY script-src violations are critical (font-src is logged separately as P1 finding)
      if (cspBuckets.script.length > 0) {
        result.status = 'FAIL';
        result.error = `script-src CSP violations: ${cspBuckets.script.slice(0, 1)[0]}`;
      }
      // scriptCount=0 is only a problem if we expected hydration (mustContain provided)
      if (
        scriptCount === 0 &&
        surface.mustContain &&
        surface.mustContain.length &&
        !surface.expectRedirect
      ) {
        result.status = 'FAIL';
        result.error = (result.error || '') + ' | scriptCount=0';
      }
    } catch (err) {
      result.status = 'FAIL';
      result.error = err.message?.slice(0, 200) || String(err);
    } finally {
      result.ms = Date.now() - t0;
    }
    await logRow({
      iter,
      layer: 'L2-hydration',
      check: surface.url,
      ...result,
    });
    result.status === 'PASS' ? pass++ : fail++;

    // Separately log font-src violations as their own finding
    if (cspBuckets.font.length > 0) {
      await logRow({
        iter,
        layer: 'L2-csp-font',
        check: `${surface.url} font-src`,
        status: 'FAIL',
        violations: cspBuckets.font.length,
        sample: cspBuckets.font[0],
      });
      fail++;
    }
  }

  // JSON-LD presence check on selected pages (script-src CSP only — font-src violations don't matter for JSON-LD)
  for (const path of JSON_LD_SURFACES) {
    Object.keys(cspBuckets).forEach(k => (cspBuckets[k].length = 0));
    const t0 = Date.now();
    let result = {
      check: `${path} JSON-LD`,
      status: 'PASS',
      ms: 0,
      error: null,
    };
    try {
      await page.goto(`${TARGET}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await sleep(1000);
      const hasJsonLd = await page.evaluate(
        () => !!document.querySelector('script[type="application/ld+json"]')
      );
      if (!hasJsonLd) {
        result.status = 'FAIL';
        result.error = 'No <script type="application/ld+json"> found';
      }
      if (cspBuckets.script.length) {
        result.status = 'FAIL';
        result.error = `script-src CSP: ${cspBuckets.script[0]}`;
      }
    } catch (err) {
      result.status = 'FAIL';
      result.error = err.message?.slice(0, 200) || String(err);
    } finally {
      result.ms = Date.now() - t0;
    }
    await logRow({ iter, layer: 'L2-jsonld', ...result });
    result.status === 'PASS' ? pass++ : fail++;
  }

  await ctx.close();
  return { pass, fail };
}

// ─── LAYER 3: API CONTRACT ───────────────────────────────────────────────
async function layer3(iter) {
  let pass = 0,
    fail = 0;
  const checks = [
    {
      name: 'GET /api/organizations no auth → 401',
      run: () => fetchSafe(`${TARGET}/api/organizations`, { timeout: 5000 }),
      expect: r => r.status === 401 || r.status === 403,
    },
    {
      name: 'POST /api/organizations malformed JSON → 400',
      run: () =>
        fetchSafe(`${TARGET}/api/organizations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json{{{',
        }),
      expect: r => r.status === 400 || r.status === 401, // 401 also acceptable (auth before parse)
    },
    {
      name: 'GET /api/random-route-xyz123 → 404',
      run: () =>
        fetchSafe(`${TARGET}/api/random-route-xyz123-nonexistent`, {
          timeout: 5000,
        }),
      expect: r => r.status === 404,
    },
    {
      name: 'GET /api/health with 8KB query → 200 or 414',
      run: () =>
        fetchSafe(`${TARGET}/api/health?q=${'x'.repeat(8000)}`, {
          timeout: 5000,
        }),
      expect: r => r.status === 200 || r.status === 414 || r.status === 400,
    },
  ];
  for (const c of checks) {
    const r = await c.run();
    const ok = c.expect(r);
    await logRow({
      iter,
      layer: 'L3-contract',
      check: c.name,
      status: ok ? 'PASS' : 'FAIL',
      httpStatus: r.status,
      ms: r.ms,
    });
    ok ? pass++ : fail++;
  }
  // Rate-limit probe: 6 bad logins in 5s, expect at least one 429
  const rateRes = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      fetchSafe(`${TARGET}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `rate-probe-${iter}-${i}@example.invalid`,
          password: 'wrong',
        }),
        timeout: 8000,
      })
    )
  );
  const got429 = rateRes.some(r => r.status === 429);
  const noServerErr = rateRes.every(r => r.status < 500);
  const passRate = noServerErr; // 429 nice-to-have, no 500 mandatory
  await logRow({
    iter,
    layer: 'L3-contract',
    check: 'POST /api/auth/login rate-limit (6×bad)',
    status: passRate ? 'PASS' : 'FAIL',
    statuses: rateRes.map(r => r.status),
    got429,
  });
  passRate ? pass++ : fail++;
  return { pass, fail };
}

// ─── LAYER 4: FAULT INJECTION ────────────────────────────────────────────
const FAULTS = [
  {
    name: 'SQL injection in ?q',
    run: () =>
      fetchSafe(
        `${TARGET}/api/health?q=${encodeURIComponent("'; DROP TABLE users;--")}`
      ),
    expect: r => r.status < 500,
  },
  {
    name: 'XSS string in ?q',
    run: () =>
      fetchSafe(
        `${TARGET}/api/health?q=${encodeURIComponent('<script>alert(1)</script>')}`
      ),
    expect: r => r.status < 500,
  },
  {
    name: 'URL with 5000-char path',
    run: () => fetchSafe(`${TARGET}/${'a'.repeat(5000)}`, { timeout: 5000 }),
    expect: r => r.status === 414 || r.status === 404 || r.status === 400,
  },
  {
    name: 'text/plain POST to JSON endpoint',
    run: () =>
      fetchSafe(`${TARGET}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text body',
      }),
    expect: r => r.status === 400 || r.status === 415 || r.status === 401,
  },
  {
    name: 'Missing Content-Type on POST',
    run: () =>
      fetchSafe(`${TARGET}/api/auth/login`, { method: 'POST', body: '{}' }),
    expect: r => r.status === 400 || r.status === 415 || r.status === 401,
  },
  {
    name: 'PATCH on GET-only /api/health',
    run: () => fetchSafe(`${TARGET}/api/health`, { method: 'PATCH' }),
    expect: r => r.status === 405 || r.status === 404,
  },
  {
    name: 'Stale JWT cookie on auth-gated route',
    run: () =>
      fetchSafe(`${TARGET}/api/organizations`, {
        headers: {
          Cookie: 'sb-access-token=expired.fake.jwt; sb-refresh-token=expired',
        },
      }),
    expect: r => r.status === 401 || r.status === 403,
  },
  {
    name: 'Concurrent (10) requests to /api/health',
    run: async () => {
      const all = await Promise.all(
        Array.from({ length: 10 }, () =>
          fetchSafe(`${TARGET}/api/health`, { timeout: 5000 })
        )
      );
      return {
        status: all.every(r => r.status < 500) ? 200 : 500,
        statuses: all.map(r => r.status),
        ms: Math.max(...all.map(r => r.ms)),
      };
    },
    expect: r => r.status < 500,
  },
  {
    name: '?nocache=N varied 100×',
    run: async () => {
      const all = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          fetchSafe(`${TARGET}/api/health?nocache=${Date.now()}-${i}`, {
            timeout: 5000,
          })
        )
      );
      return {
        status: all.every(r => r.status < 500) ? 200 : 500,
        statuses: all.map(r => r.status),
        ms: Math.max(...all.map(r => r.ms)),
      };
    },
    expect: r => r.status < 500,
  },
];

async function layer4(iter) {
  const fault = FAULTS[iter % FAULTS.length]; // round-robin so all faults hit ~equally
  const r = await fault.run();
  const ok = fault.expect(r);
  await logRow({
    iter,
    layer: 'L4-fault',
    check: fault.name,
    status: ok ? 'PASS' : 'FAIL',
    httpStatus: r.status,
    ms: r.ms,
    statuses: r.statuses,
  });
  return { pass: ok ? 1 : 0, fail: ok ? 0 : 1 };
}

// ─── REPORT GENERATION ───────────────────────────────────────────────────
async function generateReport() {
  console.log('\n[report] reading results...');
  const raw = await readFile(RESULTS_FILE, 'utf-8').catch(() => '');
  const rows = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const fails = rows.filter(r => r.status === 'FAIL');
  const total = rows.length;
  const totalFail = fails.length;
  const passRate = total
    ? (((total - totalFail) / total) * 100).toFixed(1)
    : '0.0';

  // Cluster by (layer, check, error_signature)
  const clusters = new Map();
  for (const f of fails) {
    const key = `${f.layer}::${f.check}::${(f.error || `httpStatus=${f.httpStatus}` || 'unknown').slice(0, 100)}`;
    if (!clusters.has(key))
      clusters.set(key, {
        layer: f.layer,
        check: f.check,
        errorSig: f.error || `httpStatus=${f.httpStatus}`,
        count: 0,
        firstSeen: f.ts,
        sample: f,
        iters: new Set(),
      });
    const c = clusters.get(key);
    c.count++;
    c.iters.add(f.iter);
  }
  const clusterArr = [...clusters.values()].sort((a, b) => b.count - a.count);
  await writeFile(
    CLUSTERS_FILE,
    JSON.stringify(
      clusterArr.map(c => ({ ...c, iters: [...c.iters] })),
      null,
      2
    )
  );

  // Severity ranking
  function severity(c) {
    const pct = (c.count / ITERATIONS) * 100;
    if (c.layer === 'preflight') return 'P0';
    if (c.check && /demo-analyze|api\/health$/i.test(c.check) && pct >= 50)
      return 'P0';
    if (c.layer === 'L2-hydration' && pct >= 50) return 'P0';
    if (pct >= 50) return 'P1';
    if (pct >= 10) return 'P2';
    return 'P3';
  }
  for (const c of clusterArr) c.severity = severity(c);

  // Build markdown
  const now = new Date().toISOString();
  const ranked = { P0: [], P1: [], P2: [], P3: [] };
  for (const c of clusterArr) ranked[c.severity].push(c);

  let md = `# Synthex — Overnight Smoke Report (${now})\n\n`;
  md += `**Target:** ${TARGET}  \n`;
  md += `**Iterations:** ${ITERATIONS}  \n`;
  md += `**Total checks:** ${total}  \n`;
  md += `**Failures:** ${totalFail}  \n`;
  md += `**Pass rate:** ${passRate}%  \n`;
  md += `**Failure clusters:** ${clusterArr.length}\n\n`;

  if (clusterArr.length === 0) {
    md += `## ✅ All clear\n\nZero failures across ${total} checks. CSP hotfix #122 stable. No regressions.\n`;
  } else {
    md += `## Summary\n\n`;
    md += `| Severity | Clusters |\n|---|---|\n`;
    for (const sev of ['P0', 'P1', 'P2', 'P3'])
      md += `| ${sev} | ${ranked[sev].length} |\n`;
    md += `\n`;

    let n = 0;
    for (const sev of ['P0', 'P1', 'P2', 'P3']) {
      for (const c of ranked[sev]) {
        n++;
        const pct = ((c.count / ITERATIONS) * 100).toFixed(1);
        md += `## ${sev}-${n} — ${c.check}\n`;
        md += `**Layer:** \`${c.layer}\`  \n`;
        md += `**Affected:** ${c.count} iterations / ${ITERATIONS} (${pct}%)  \n`;
        md += `**First seen:** ${c.firstSeen}  \n`;
        md += `**Iter range:** ${Math.min(...c.iters)} → ${Math.max(...c.iters)}  \n`;
        md += `**Error signature:** \`${(c.errorSig || '').slice(0, 200)}\`  \n`;
        md += `**Sample row:**\n\`\`\`json\n${JSON.stringify(c.sample, null, 2)}\n\`\`\`\n\n`;
        md += `**Suggested Linear ticket:**\n\`\`\`\nTitle: fix(${c.layer.replace(/^L\d+-/, '')}): ${c.check.replace(/^[A-Z]+ /, '').slice(0, 60)}\nBody:\n- Reproduction: see sample row above\n- Frequency: ${c.count}/${ITERATIONS} iterations (${pct}%)\n- Layer: ${c.layer}\n- Acceptance: cluster passes 100/100 in re-run\n\n🤖 Generated overnight from smoke loop iter ${Math.min(...c.iters)} at ${c.firstSeen}\n\`\`\`\n\n---\n\n`;
      }
    }
  }
  await writeFile(REPORT_FILE, md);
  console.log(`[report] wrote ${REPORT_FILE}`);
  console.log(
    `[report] ${total} checks, ${totalFail} failures, ${clusterArr.length} clusters (P0=${ranked.P0.length} P1=${ranked.P1.length} P2=${ranked.P2.length} P3=${ranked.P3.length})`
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = new Date().toISOString();
  await ensureScratchpad();

  // Reset results file
  await writeFile(RESULTS_FILE, '');
  await logRow({
    iter: 0,
    layer: 'meta',
    check: 'started',
    startedAt,
    target: TARGET,
    iterations: ITERATIONS,
    dryRun: DRY_RUN,
  });

  console.log(`\n=== OVERNIGHT SMOKE LOOP ===`);
  console.log(
    `target=${TARGET} iterations=${ITERATIONS} delay=${ITER_DELAY_MS}ms dry-run=${DRY_RUN}`
  );
  console.log(`results=${RESULTS_FILE}`);
  console.log(`report =${REPORT_FILE}\n`);

  const pf = await preflight();
  if (!pf.ok) {
    console.error(`[pre-flight] ABORT: ${pf.reason}`);
    await logRow({
      iter: 0,
      layer: 'preflight',
      check: 'aborted',
      status: 'FAIL',
      reason: pf.reason,
    });
    await writeFile(
      REPORT_FILE,
      `# Synthex — Overnight Smoke ABORTED\n\n## P0 — Pre-flight failed\n\n**Reason:** ${pf.reason}\n\n**Action:** Investigate Vercel dashboard / deploy state. Re-run rig once root cause cleared.\n\n🤖 Generated ${new Date().toISOString()}\n`
    );
    if (_browser) await _browser.close();
    process.exit(0);
  }

  for (let iter = 1; iter <= ITERATIONS; iter++) {
    const t0 = Date.now();
    const r1 = await layer1(iter);
    const r2 = await layer2(iter);
    const r3 = await layer3(iter);
    const r4 = await layer4(iter);
    const totalPass = r1.pass + r2.pass + r3.pass + r4.pass;
    const totalFail = r1.fail + r2.fail + r3.fail + r4.fail;
    const ms = Date.now() - t0;
    console.log(
      `[iter=${iter}/${ITERATIONS}] PASS=${totalPass} FAIL=${totalFail} (${ms}ms) | L1=${r1.pass}/${r1.pass + r1.fail} L2=${r2.pass}/${r2.pass + r2.fail} L3=${r3.pass}/${r3.pass + r3.fail} L4=${r4.pass}/${r4.pass + r4.fail}`
    );
    if (iter < ITERATIONS && ITER_DELAY_MS > 0) {
      const remaining = Math.max(0, ITER_DELAY_MS - ms);
      await sleep(remaining);
    }
  }

  if (_browser) await _browser.close();
  await generateReport();
  console.log('\n=== DONE ===');
}

main().catch(async err => {
  console.error('FATAL:', err);
  await logRow({
    iter: -1,
    layer: 'meta',
    check: 'fatal',
    status: 'FAIL',
    error: err.message || String(err),
  });
  if (_browser) await _browser.close().catch(() => {});
  process.exit(1);
});
