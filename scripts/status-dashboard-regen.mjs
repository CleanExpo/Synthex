#!/usr/bin/env node
// scripts/status-dashboard-regen.mjs
//
// Regenerates .claude/scratchpad/status-dashboard.html with the latest:
//   - Production health snapshot (synthex.social)
//   - In-flight PRs with CI status
//   - Last 10 squash-merges
//   - Active Linear epics (read from a small inline list)
//   - Current "what's being worked on" (last commit message + working branch)
//
// All timestamps in Brisbane time (Australia/Brisbane, UTC+10, no DST).
//
// Usage:
//   node scripts/status-dashboard-regen.mjs
//
// To keep dashboard fresh while you have it open:
//   - The HTML auto-reloads from disk every 120s (meta refresh)
//   - Run this script periodically (or stick it in a 60s loop) to repopulate
//
// Self-contained: no npm deps beyond what's already installed (gh CLI + git in PATH).

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SCRATCHPAD = resolve(REPO_ROOT, '.claude/scratchpad');
const OUTPUT = resolve(SCRATCHPAD, 'status-dashboard.html');

const REPO = 'CleanExpo/Synthex';

function brisbaneNow() {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function brisbaneShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd: opts.cwd || REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return '';
  }
}

async function fetchSafe(url, opts = {}) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeout || 8000);
    const res = await fetch(url, { ...opts, signal: ac.signal });
    clearTimeout(t);
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function probeProduction() {
  const cspResp = await fetchSafe('https://synthex.social/login', {
    method: 'HEAD',
  });
  const cspHeader = (cspResp.body || '').match(/content-security-policy/i)
    ? ''
    : '';
  // Re-fetch with header parsing
  const cspGet = await fetch('https://synthex.social/login', {
    method: 'HEAD',
  }).catch(() => null);
  const csp = cspGet?.headers?.get?.('content-security-policy') || '';
  const cspFontshare = csp.includes('cdn.fontshare.com');
  const cspUnsafeInline = /script-src[^;]*'unsafe-inline'/.test(csp);

  const healthResp = await fetchSafe('https://synthex.social/api/health', {
    timeout: 8000,
  });
  let healthStatus = 'unknown';
  let healthDetails = {};
  try {
    const j = JSON.parse(healthResp.body || '{}');
    healthStatus = j.status || 'unknown';
    healthDetails = j.checks || {};
  } catch {}

  const demoResp = await fetchSafe('https://synthex.social/api/demo/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://google.com.au' }),
    timeout: 15000,
  });
  let demoOk = false;
  try {
    const j = JSON.parse(demoResp.body || '{}');
    demoOk = !!j.businessName && !!j.caption;
  } catch {}

  return {
    cspFontshareLive: cspFontshare,
    cspUnsafeInlineLive: cspUnsafeInline,
    healthHttp: healthResp.status,
    healthStatus,
    healthDetails,
    demoOk,
    demoHttp: demoResp.status,
    cspHeaderSnippet: csp.slice(0, 280),
  };
}

function listOpenPRs() {
  const json = sh(
    `gh pr list --repo ${REPO} --state open --json number,title,statusCheckRollup,createdAt,author --limit 20`
  );
  if (!json) return [];
  try {
    return JSON.parse(json).map(pr => {
      const checks = pr.statusCheckRollup || [];
      const fail = checks.filter(c => c.conclusion === 'FAILURE').length;
      const pending = checks.filter(
        c =>
          c.status === 'IN_PROGRESS' ||
          c.status === 'QUEUED' ||
          c.status === 'PENDING'
      ).length;
      const success = checks.filter(c => c.conclusion === 'SUCCESS').length;
      return {
        number: pr.number,
        title: pr.title,
        author: pr.author?.login || '?',
        createdAt: pr.createdAt,
        fail,
        pending,
        success,
      };
    });
  } catch {
    return [];
  }
}

function recentMerges() {
  const out = sh(`git log --oneline -15 --pretty=format:%h|%s|%an|%aI`);
  return out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, subject, author, iso] = line.split('|');
      const prMatch = subject.match(/\(#(\d+)\)/);
      return {
        sha: sha.slice(0, 7),
        subject,
        author,
        iso,
        pr: prMatch ? prMatch[1] : null,
      };
    });
}

function currentBranch() {
  return sh('git rev-parse --abbrev-ref HEAD');
}

function uncommittedCount() {
  const out = sh('git status --short');
  return out.split('\n').filter(Boolean).length;
}

const ACTIVE_EPICS = [
  {
    id: 'SYN-806',
    url: 'https://linear.app/unite-group/issue/SYN-806',
    title: '[EPIC] Senior-level AI Marketing Agency uplift',
    status: 'In Progress (Phase 3 complete)',
  },
  {
    id: 'SYN-822',
    url: 'https://linear.app/unite-group/issue/SYN-822',
    title:
      '[EPIC] AEO / Entity-Recognition local-SEO programme across portfolio',
    status: 'Backlog · 11 children · Phase A audit landed',
  },
  {
    id: 'SYN-834',
    url: 'https://linear.app/unite-group/issue/SYN-834',
    title:
      '[EPIC] NRPG contractor onboarding → DR dynamic service-area expansion',
    status: 'Backlog · 9 children · architecture defined 2026-04-29',
  },
];

const RECENT_AEO_FINDINGS = [
  {
    severity: 'P0',
    ticket: 'RA-1806',
    url: 'https://linear.app/unite-group/issue/RA-1806',
    title: 'RestoreAssist Aid Rule violation × 3 in homepage JSON-LD',
  },
  {
    severity: 'P1',
    ticket: 'DR-825',
    url: 'https://linear.app/unite-group/issue/DR-825',
    title: 'DR schema-vs-content mismatch (Q3.2.3 A4)',
  },
  {
    severity: 'P1',
    ticket: 'UNI-1972',
    url: 'https://linear.app/unite-group/issue/UNI-1972',
    title: 'CARSI unverified category claim "Australia\'s leading"',
  },
  {
    severity: 'P2',
    ticket: 'UNI-1973',
    url: 'https://linear.app/unite-group/issue/UNI-1973',
    title: 'external client homepage has zero JSON-LD schema',
  },
];

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sevColor(sev) {
  return (
    {
      P0: 'bg-red-500/15 text-red-300 border-red-500/30',
      P1: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      P2: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      P3: 'bg-white/5 text-white/50 border-white/10',
    }[sev] || 'bg-white/5 text-white/50 border-white/10'
  );
}

function statusDot(state) {
  if (state === 'green')
    return '<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>';
  if (state === 'amber')
    return '<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>';
  if (state === 'red')
    return '<span class="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>';
  return '<span class="inline-block w-2 h-2 rounded-full bg-white/30"></span>';
}

function render(data) {
  const { nowBris, prod, prs, merges, branch, uncommitted } = data;
  const prodOverall =
    prod.cspFontshareLive &&
    prod.cspUnsafeInlineLive &&
    prod.healthHttp === 200 &&
    prod.demoOk;
  const prodAmber =
    !prodOverall &&
    (prod.cspUnsafeInlineLive || prod.healthHttp === 200 || prod.demoOk);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Synthex Status · ${htmlEscape(nowBris)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="120" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .grid-bg { background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 24px 24px; }
</style>
</head>
<body class="bg-[#050508] text-white/90 grid-bg min-h-screen">
<div class="max-w-7xl mx-auto px-6 py-8">
  <header class="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
    <div>
      <h1 class="text-2xl font-light tracking-wide">Synthex Status</h1>
      <p class="text-xs text-white/40 mt-1 mono">${htmlEscape(nowBris)} · Australia/Brisbane · auto-reloads every 120s</p>
    </div>
    <div class="flex items-center gap-3">
      ${statusDot(prodOverall ? 'green' : prodAmber ? 'amber' : 'red')}
      <span class="text-xs uppercase tracking-[0.2em] text-white/60">${prodOverall ? 'all systems go' : prodAmber ? 'degraded' : 'check now'}</span>
    </div>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

    <!-- Production health -->
    <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5 col-span-1">
      <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">Production · synthex.social</h2>
      <ul class="space-y-2.5 text-sm">
        <li class="flex justify-between items-center">
          <span class="text-white/70">CSP <span class="text-white/40 mono">'unsafe-inline'</span></span>
          ${statusDot(prod.cspUnsafeInlineLive ? 'green' : 'red')}
        </li>
        <li class="flex justify-between items-center">
          <span class="text-white/70">CSP <span class="text-white/40 mono">cdn.fontshare.com</span></span>
          ${statusDot(prod.cspFontshareLive ? 'green' : 'red')}
        </li>
        <li class="flex justify-between items-center">
          <span class="text-white/70">/api/health</span>
          <span class="flex items-center gap-2">
            <span class="text-xs mono text-white/50">HTTP ${prod.healthHttp}</span>
            ${statusDot(prod.healthHttp === 200 ? 'green' : 'red')}
          </span>
        </li>
        <li class="flex justify-between items-center">
          <span class="text-white/70">/api/demo/analyze</span>
          <span class="flex items-center gap-2">
            <span class="text-xs mono text-white/50">HTTP ${prod.demoHttp}</span>
            ${statusDot(prod.demoOk ? 'green' : 'red')}
          </span>
        </li>
      </ul>
      <div class="mt-4 pt-4 border-t border-white/5 text-[10px] text-white/40 mono break-all">${htmlEscape(prod.cspHeaderSnippet)}…</div>
    </section>

    <!-- In flight -->
    <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5 col-span-2">
      <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">In flight · ${prs.length} open PR${prs.length === 1 ? '' : 's'}</h2>
      ${
        prs.length === 0
          ? '<p class="text-sm text-emerald-300/80">✓ Queue empty — no open PRs.</p>'
          : '<ul class="space-y-3">' +
            prs
              .map(
                pr => `
        <li class="flex items-center justify-between gap-3 text-sm">
          <a href="https://github.com/${REPO}/pull/${pr.number}" target="_blank" class="flex-1 min-w-0">
            <span class="mono text-white/40">#${pr.number}</span>
            <span class="text-white/80 ml-2">${htmlEscape(pr.title.slice(0, 80))}${pr.title.length > 80 ? '…' : ''}</span>
            <span class="text-[10px] text-white/30 mono ml-2">@${htmlEscape(pr.author)} · ${brisbaneShort(pr.createdAt)}</span>
          </a>
          <div class="flex items-center gap-2 shrink-0">
            ${pr.fail > 0 ? `<span class="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">${pr.fail} fail</span>` : ''}
            ${pr.pending > 0 ? `<span class="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">${pr.pending} pending</span>` : ''}
            <span class="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${pr.success} ✓</span>
            ${statusDot(pr.fail > 0 ? 'red' : pr.pending > 0 ? 'amber' : 'green')}
          </div>
        </li>`
              )
              .join('') +
            '</ul>'
      }
    </section>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

    <!-- Recent ships -->
    <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5">
      <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">Recently shipped (last 15 commits to main)</h2>
      <ul class="space-y-2 text-xs">
        ${merges
          .map(
            m => `
        <li class="flex items-start gap-3">
          <span class="text-white/30 mono shrink-0 w-16">${m.sha}</span>
          <span class="text-white/70 flex-1">${htmlEscape(m.subject.slice(0, 90))}${m.subject.length > 90 ? '…' : ''}</span>
          <span class="text-white/30 shrink-0 mono">${brisbaneShort(m.iso)}</span>
        </li>`
          )
          .join('')}
      </ul>
    </section>

    <!-- Active Linear epics -->
    <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5">
      <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">Active Linear epics</h2>
      <ul class="space-y-3 text-sm">
        ${ACTIVE_EPICS.map(
          e => `
        <li>
          <a href="${e.url}" target="_blank" class="block group">
            <div class="flex items-center gap-2">
              <span class="mono text-amber-400/80">${e.id}</span>
              <span class="text-white/80 group-hover:text-white">${htmlEscape(e.title)}</span>
            </div>
            <div class="text-[11px] text-white/40 mt-0.5 ml-1">${htmlEscape(e.status)}</div>
          </a>
        </li>`
        ).join('')}
      </ul>
    </section>
  </div>

  <!-- Recent findings -->
  <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5 mb-8">
    <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">Recent AEO audit findings (across portfolio)</h2>
    <ul class="space-y-2 text-sm">
      ${RECENT_AEO_FINDINGS.map(
        f => `
      <li class="flex items-center gap-3">
        <span class="text-xs px-2 py-0.5 rounded border ${sevColor(f.severity)}">${f.severity}</span>
        <a href="${f.url}" target="_blank" class="mono text-amber-400/80 hover:text-amber-300">${f.ticket}</a>
        <span class="text-white/70 flex-1">${htmlEscape(f.title)}</span>
      </li>`
      ).join('')}
    </ul>
  </section>

  <!-- Working state -->
  <section class="bg-[#0a0a12] border border-white/10 rounded-md p-5">
    <h2 class="text-sm font-medium text-white/60 uppercase tracking-[0.15em] mb-4">Working state</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
      <div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-white/40">Branch</div>
        <div class="mono text-white/80 mt-1 text-xs">${htmlEscape(branch || 'unknown')}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-white/40">Uncommitted</div>
        <div class="mono text-white/80 mt-1 text-xs">${uncommitted} file${uncommitted === 1 ? '' : 's'}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-white/40">Repo</div>
        <div class="mono text-white/80 mt-1 text-xs">${REPO}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.15em] text-white/40">Refresh</div>
        <div class="mono text-white/80 mt-1 text-xs">120 s · auto</div>
      </div>
    </div>
  </section>

  <footer class="mt-8 pt-4 border-t border-white/5 text-[10px] text-white/30 mono flex items-center justify-between">
    <span>Generated by scripts/status-dashboard-regen.mjs · re-run to refresh data</span>
    <span>Synthex SaaS · CleanExpo / Synthex</span>
  </footer>
</div>
</body>
</html>`;
}

async function main() {
  if (!existsSync(SCRATCHPAD)) await mkdir(SCRATCHPAD, { recursive: true });
  console.log('[status-dashboard] gathering data…');
  const [prod, prs, merges] = await Promise.all([
    probeProduction(),
    Promise.resolve(listOpenPRs()),
    Promise.resolve(recentMerges()),
  ]);
  const data = {
    nowBris: brisbaneNow(),
    prod,
    prs,
    merges,
    branch: currentBranch(),
    uncommitted: uncommittedCount(),
  };
  const html = render(data);
  await writeFile(OUTPUT, html);
  console.log(`[status-dashboard] wrote ${OUTPUT}`);
  console.log(
    `[status-dashboard] open file://${OUTPUT.replace(/\\/g, '/')} in your browser`
  );
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
