#!/usr/bin/env node
/**
 * merge-gate — answers one question: is this branch safe to merge into main?
 *
 * It never reads your live working tree. It builds a throwaway worktree at
 * (branch merged with origin/main), runs the real gates there, compares the
 * result against what main already fails, and prints a single line.
 *
 *   npm run gate                  # gate the current branch
 *   npm run gate -- <branch>      # gate a named branch
 *   npm run gate -- --fast        # skip build and full test suite
 *   npm run gate -- --baseline    # re-record what main itself fails
 *
 * Deterministic gates own the verdict. Nothing advisory can flip it.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const GATE_WORKTREE = path.join(REPO, '.worktrees', 'gate');
const EVIDENCE_ROOT = path.join(REPO, '.harness', 'gate');
const STATE_FILE = path.join(EVIDENCE_ROOT, 'state.json');
const BASELINE_FILE = path.join(EVIDENCE_ROOT, 'main-baseline.json');
const REQUIRED_NODE_MAJOR = 22;

const argv = process.argv.slice(2);
const FAST = argv.includes('--fast');
const REBASELINE = argv.includes('--baseline');
const branchArg = argv.find((a) => !a.startsWith('--'));

/** Run a command, capture everything, never throw. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(opts.env ?? {}) },
    timeout: opts.timeout,
  });
  return {
    code: r.status ?? (r.error ? -1 : 0),
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    error: r.error,
  };
}

const git = (args, opts) => run('git', args, opts);

function fail(msg) {
  console.error(`NOT SAFE — ${msg}`);
  process.exitCode = 1;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Environment
// ---------------------------------------------------------------------------
function assertEnvironment() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== REQUIRED_NODE_MAJOR) {
    fail(
      `wrong Node version. This repo and CI both require Node ${REQUIRED_NODE_MAJOR}.x; ` +
        `this shell has ${process.versions.node}. The gate refuses to guess.`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 2. Build the merged worktree
// ---------------------------------------------------------------------------
function ensureWorktree() {
  if (!fs.existsSync(path.join(GATE_WORKTREE, '.git'))) {
    fs.mkdirSync(path.dirname(GATE_WORKTREE), { recursive: true });
    const add = git(['worktree', 'add', '--detach', GATE_WORKTREE, 'HEAD']);
    if (add.code !== 0) {
      fail(`could not create the gate worktree.\n${add.out}`);
      process.exit(1);
    }
  }
}

/** Returns { ok, conflicts[], sha, mainSha } */
function buildMergedTree(branch) {
  git(['fetch', 'origin', 'main', '--quiet']);

  const headSha = git(['rev-parse', branch]).out.trim();
  const mainSha = git(['rev-parse', 'origin/main']).out.trim();

  git(['merge', '--abort'], { cwd: GATE_WORKTREE });
  git(['reset', '--hard', '--quiet', headSha], { cwd: GATE_WORKTREE });
  git(['clean', '-fdq', '-e', 'node_modules', '-e', '.next'], { cwd: GATE_WORKTREE });

  const merge = git(['merge', '--no-edit', mainSha], { cwd: GATE_WORKTREE });
  if (merge.code !== 0) {
    const conflicts = git(['diff', '--name-only', '--diff-filter=U'], { cwd: GATE_WORKTREE })
      .out.split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    git(['merge', '--abort'], { cwd: GATE_WORKTREE });
    return { ok: false, conflicts, sha: headSha, mainSha };
  }

  const mergedSha = git(['rev-parse', 'HEAD'], { cwd: GATE_WORKTREE }).out.trim();
  return { ok: true, conflicts: [], sha: headSha, mainSha, mergedSha };
}

// ---------------------------------------------------------------------------
// 3. Dependencies — reinstall only when the lockfile actually changed
// ---------------------------------------------------------------------------
function ensureDependencies() {
  const lock = path.join(GATE_WORKTREE, 'package-lock.json');
  const hash = createHash('sha256').update(fs.readFileSync(lock)).digest('hex').slice(0, 16);
  const state = readJson(STATE_FILE, {});
  const installed = fs.existsSync(path.join(GATE_WORKTREE, 'node_modules', 'typescript'));

  if (state.lockHash === hash && installed) return { reused: true, hash };

  const install = run('npm', ['ci', '--legacy-peer-deps'], {
    cwd: GATE_WORKTREE,
    timeout: 15 * 60 * 1000,
  });
  if (install.code !== 0) {
    return { reused: false, hash, failed: true, out: install.out };
  }
  writeJson(STATE_FILE, { ...state, lockHash: hash });
  return { reused: false, hash };
}

// ---------------------------------------------------------------------------
// 4. The gates
// ---------------------------------------------------------------------------
function gateList() {
  const all = [
    { key: 'typecheck', label: 'Type Check', script: 'type-check' },
    { key: 'lint', label: 'Lint', script: 'lint' },
    { key: 'test', label: 'Unit Tests', script: 'test' },
    { key: 'build', label: 'Build', script: 'build' },
  ];
  return FAST ? all.filter((g) => g.key === 'typecheck' || g.key === 'lint') : all;
}

function runGates(cwd, evidenceDir) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = {};
  for (const gate of gateList()) {
    process.stderr.write(`  running ${gate.label}...\n`);
    const r = run('npm', ['run', gate.script, '--silent'], { cwd, timeout: 30 * 60 * 1000 });
    fs.writeFileSync(path.join(evidenceDir, `${gate.key}.txt`), r.out, 'utf8');
    results[gate.key] = { label: gate.label, code: r.code, signature: signature(gate.key, r.out) };
  }
  return results;
}

/**
 * A stable fingerprint of what failed, so "same breakage as main" can be told
 * apart from "new breakage this branch introduced".
 */
function signature(key, out) {
  const lines = out.split('\n');
  if (key === 'typecheck') {
    return lines
      .filter((l) => /error TS\d+/.test(l))
      .map((l) => l.replace(/\(\d+,\d+\)/, '').trim())
      .sort();
  }
  if (key === 'lint') {
    return lines
      .filter((l) => /\s+error\s+/.test(l))
      .map((l) => l.replace(/^\s*\d+:\d+/, '').trim())
      .sort();
  }
  if (key === 'test') {
    return lines
      .filter((l) => /^(FAIL|●)/.test(l.trim()))
      .map((l) => l.trim())
      .sort();
  }
  return lines.filter((l) => /error/i.test(l)).map((l) => l.trim()).slice(0, 50).sort();
}

// ---------------------------------------------------------------------------
// 5. Baseline — what main itself already fails
// ---------------------------------------------------------------------------
function recordBaseline() {
  const mainSha = git(['rev-parse', 'origin/main']).out.trim();
  process.stderr.write(`Recording baseline for main @ ${mainSha.slice(0, 9)}\n`);
  git(['merge', '--abort'], { cwd: GATE_WORKTREE });
  git(['reset', '--hard', '--quiet', mainSha], { cwd: GATE_WORKTREE });
  const deps = ensureDependencies();
  if (deps.failed) {
    fail(`baseline install failed.\n${deps.out.slice(-2000)}`);
    process.exit(1);
  }
  const results = runGates(GATE_WORKTREE, path.join(EVIDENCE_ROOT, 'baseline'));
  writeJson(BASELINE_FILE, { mainSha, recordedAt: new Date().toISOString(), results });
  return { mainSha, results };
}

function loadBaseline(mainSha) {
  const b = readJson(BASELINE_FILE, null);
  if (!b) return { stale: true, reason: 'no baseline recorded', results: {} };
  if (b.mainSha !== mainSha) {
    return { stale: true, reason: `baseline is for main @ ${b.mainSha.slice(0, 9)}`, results: b.results };
  }
  return { stale: false, results: b.results };
}

/** Failures present on the branch but not on main. */
function newFailures(branchResults, baselineResults) {
  const out = [];
  for (const [key, r] of Object.entries(branchResults)) {
    if (r.code === 0) continue;
    const base = baselineResults[key];
    const baseSet = new Set(base?.signature ?? []);
    const introduced = r.signature.filter((s) => !baseSet.has(s));
    const preexisting = base && base.code !== 0;
    out.push({ key, label: r.label, introduced, preexisting, total: r.signature.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. GitHub check freshness
// ---------------------------------------------------------------------------
function githubChecks(branch, headSha) {
  const pr = run('gh', [
    'pr', 'list', '--head', branch, '--state', 'open',
    '--json', 'number,headRefOid,statusCheckRollup', '--limit', '1',
  ]);
  if (pr.code !== 0) return { available: false, reason: 'gh CLI unavailable or not authenticated' };
  let parsed;
  try {
    parsed = JSON.parse(pr.out);
  } catch {
    return { available: false, reason: 'could not parse gh output' };
  }
  if (!parsed.length) return { available: true, hasPr: false };

  const [p] = parsed;
  const rollup = p.statusCheckRollup ?? [];
  const fresh = p.headRefOid === headSha;
  const failing = rollup.filter((c) => c.conclusion === 'FAILURE').map((c) => c.name);
  const ran = rollup.filter((c) => c.conclusion && c.conclusion !== 'SKIPPED').length;
  return {
    available: true, hasPr: true, number: p.number,
    fresh, headRefOid: p.headRefOid, total: rollup.length, ran, failing,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
assertEnvironment();
ensureWorktree();

if (REBASELINE) {
  const { mainSha, results } = recordBaseline();
  const failed = Object.values(results).filter((r) => r.code !== 0).map((r) => r.label);
  console.log(
    failed.length
      ? `BASELINE RECORDED — main @ ${mainSha.slice(0, 9)} itself fails: ${failed.join(', ')}. Those will not be counted against a branch.`
      : `BASELINE RECORDED — main @ ${mainSha.slice(0, 9)} passes every gate.`,
  );
  process.exit(0);
}

const branch = branchArg ?? git(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
const slug = branch.replace(/[^a-zA-Z0-9._-]/g, '-');
const evidenceDir = path.join(EVIDENCE_ROOT, slug);

process.stderr.write(`Gating ${branch} against origin/main...\n`);

const merged = buildMergedTree(branch);
fs.mkdirSync(evidenceDir, { recursive: true });

if (!merged.ok) {
  fs.writeFileSync(path.join(evidenceDir, 'merge.txt'), merged.conflicts.join('\n'), 'utf8');
  fail(
    `${branch} does not merge with main. ${merged.conflicts.length} file(s) conflict: ` +
      `${merged.conflicts.slice(0, 5).join(', ')}${merged.conflicts.length > 5 ? ', ...' : ''}. ` +
      `Full list: ${path.relative(REPO, path.join(evidenceDir, 'merge.txt'))}`,
  );
  process.exit(1);
}

const deps = ensureDependencies();
if (deps.failed) {
  fail(`dependency install failed in the gate worktree.\n${deps.out.slice(-2000)}`);
  process.exit(1);
}

const results = runGates(GATE_WORKTREE, evidenceDir);
const baseline = loadBaseline(merged.mainSha);
const regressions = newFailures(results, baseline.results);
const checks = githubChecks(branch, merged.sha);

writeJson(path.join(evidenceDir, 'verdict.json'), {
  branch, headSha: merged.sha, mainSha: merged.mainSha, mergedSha: merged.mergedSha,
  fast: FAST, results, baseline: { stale: baseline.stale, reason: baseline.reason },
  regressions, checks, gatedAt: new Date().toISOString(),
});

// ---- the one line ----------------------------------------------------------
const introduced = regressions.filter((r) => r.introduced.length > 0);
const notes = [];
if (baseline.stale) notes.push(`baseline is stale (${baseline.reason}) — run: npm run gate -- --baseline`);
if (FAST) notes.push('fast mode: build and full test suite were not run');
if (checks.available && checks.hasPr && !checks.fresh) {
  notes.push(`GitHub checks on PR #${checks.number} are STALE (rollup is for ${checks.headRefOid?.slice(0, 9)}, branch head is ${merged.sha.slice(0, 9)})`);
}
if (checks.available && checks.hasPr && checks.ran === 0) {
  notes.push(`PR #${checks.number} has no CI results at all — it has never been gated on GitHub`);
}

if (introduced.length > 0) {
  const first = introduced[0];
  fail(
    `${first.label} fails with ${first.introduced.length} error(s) that main does not have` +
      (introduced.length > 1 ? ` (also: ${introduced.slice(1).map((r) => r.label).join(', ')})` : '') +
      `. First: ${first.introduced[0]?.slice(0, 160) ?? 'see evidence'}. ` +
      `Evidence: ${path.relative(REPO, evidenceDir)}`,
  );
} else if (checks.available && checks.hasPr && !checks.fresh) {
  fail(
    `local gates pass, but GitHub has never checked this exact commit. ` +
      `Push ${merged.sha.slice(0, 9)} and wait for CI before merging.`,
  );
} else {
  const carried = regressions.filter((r) => r.preexisting).map((r) => r.label);
  console.log(
    `SAFE TO MERGE — ${branch} @ ${merged.sha.slice(0, 9)} merges clean with main @ ${merged.mainSha.slice(0, 9)}; ` +
      `${gateList().map((g) => g.label).join(', ')} introduce no new failures` +
      (carried.length ? `; ${carried.join(' and ')} still fail on main itself and are unchanged here` : '') +
      `.`,
  );
}

for (const n of notes) console.log(`NOTE: ${n}`);
