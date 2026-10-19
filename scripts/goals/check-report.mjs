#!/usr/bin/env node
/**
 * scripts/goals/check-report.mjs [--out <path>] [--offline] [--strict] | --control
 *
 * Reports, from live evidence, the state of each goal (G1..G8) of the orchestrating
 * session. Renders scripts/goals/check-report.template.md, whose SHA-256 is locked in
 * scripts/goals/template.lock.json; the template is only ever opened read-only and is
 * re-hashed after the run.
 *
 * Four states, never three: PASS, FAIL, INCONCLUSIVE (the subject could not be read —
 * never shown as PASS), DISABLED (deliberately not run, with a reason).
 *
 * Exit 0: every goal produced a state. 1: --strict and some goal is not PASS.
 * 2: template mismatch, refused --out, or an internal crash.
 */
import { spawnSync } from 'node:child_process';
import {
  openSync,
  readSync,
  fstatSync,
  closeSync,
  existsSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  mkdtempSync,
  copyFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATES = Object.freeze([
  'PASS',
  'FAIL',
  'INCONCLUSIVE',
  'DISABLED',
]);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const TEMPLATE_REL = 'scripts/goals/check-report.template.md';
const TEMPLATE = path.join(HERE, 'check-report.template.md');
const LOCK = path.join(HERE, 'template.lock.json');
const MAIN = 'origin/main';
const NOOP_BASE = '025e17e7d412db99e942d6f9c036409ae274de23';
const HOTFIXES = [
  'fleet-unit/hotfix/unauth-reads',
  'fleet-unit/hotfix/ssrf',
  'fleet-unit/hotfix/authz-replay',
];
const SIDECARS = 'fix/media-asset-sidecars';
export const GOALS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
export const PLACEHOLDERS = [
  'GENERATED_AT',
  'MAIN_SHA',
  'SUMMARY',
  ...GOALS.flatMap(g => [`${g}_STATE`, `${g}_EVIDENCE`]),
];

// ---------------------------------------------------------------- reads

/** A read is either ok(value) or bad(error); a failed read never looks like an empty one. */
export const ok = value => ({ ok: true, value });
export const bad = error => ({ ok: false, error: String(error) });
/** A deliberately skipped read. */
export const off = reason => ({ ok: false, disabled: true, error: reason });

export function result(state, lines) {
  if (!STATES.includes(state)) throw new Error(`fifth state ${state}`);
  return { state, lines: lines.length ? lines : ['(no evidence lines)'] };
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Read a file through a read-only descriptor. */
export function readOnly(file) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(fstatSync(fd).size);
    let pos = 0;
    while (pos < buf.length) {
      const n = readSync(fd, buf, pos, buf.length - pos, pos);
      if (n === 0) break;
      pos += n;
    }
    return buf.subarray(0, pos);
  } finally {
    closeSync(fd);
  }
}

function runRaw(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    encoding: opts.buffer ? 'buffer' : 'utf8',
    timeout: opts.timeout ?? 120000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GH_PAGER: '', GIT_TERMINAL_PROMPT: '0' },
  });
  const stderr = r.stderr ? String(r.stderr) : '';
  return {
    code: r.status,
    stdout: r.stdout ?? (opts.buffer ? Buffer.alloc(0) : ''),
    stderr,
    timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    spawnError:
      r.error && r.error.code !== 'ETIMEDOUT' ? r.error.message : null,
  };
}

const lastLine = s =>
  String(s || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-1)[0] || '';

/** Classify a gh invocation: anything but exit 0 with JSON output is INCONCLUSIVE. */
export function classifyGhRead(r) {
  if (r.spawnError) return bad(`gh could not start: ${r.spawnError}`);
  if (r.timedOut) return bad('gh timed out');
  if (r.code !== 0)
    return bad(`gh exit ${r.code}: ${lastLine(r.stderr) || '(no stderr)'}`);
  try {
    return ok(JSON.parse(r.stdout));
  } catch {
    return bad('gh output is not JSON');
  }
}

function gh(args) {
  return classifyGhRead(runRaw('gh', args, { timeout: 60000 }));
}

function gitText(args) {
  const r = runRaw('git', args);
  if (r.code === 0) return ok(r.stdout);
  return bad(`git ${args[0]} exit ${r.code}: ${lastLine(r.stderr)}`);
}

function gitShow(file, buffer = false) {
  const r = runRaw('git', ['show', `${MAIN}:${file}`], { buffer });
  if (r.code === 0) return ok(r.stdout);
  return bad(`${file} unreadable at ${MAIN}: ${lastLine(r.stderr)}`);
}

function parseJson(read, what) {
  if (!read.ok) return read;
  try {
    return ok(JSON.parse(String(read.value)));
  } catch {
    return bad(`${what} is not JSON`);
  }
}

/** git ls-remote --heads for exact branch names: Map name -> sha (absent = not on origin). */
function lsRemote(patterns) {
  const r = runRaw('git', ['ls-remote', '--heads', 'origin', ...patterns], {
    timeout: 60000,
  });
  if (r.code !== 0)
    return bad(`git ls-remote exit ${r.code}: ${lastLine(r.stderr)}`);
  const m = new Map();
  for (const line of r.stdout.split('\n').filter(Boolean)) {
    const [sha, ref] = line.split('\t');
    m.set(ref.replace(/^refs\/heads\//, ''), sha);
  }
  return ok(m);
}

/** Is <sha> in origin/main's history? ok(true|false) or bad. */
function mergedIntoMain(sha) {
  const r = runRaw('git', ['merge-base', '--is-ancestor', sha, MAIN]);
  if (r.code === 0) return ok(true);
  if (r.code === 1) return ok(false);
  // Object unknown locally: main was fetched in full, so it is not in main's history.
  const c = runRaw('git', ['cat-file', '-e', `${sha}^{commit}`]);
  if (c.code !== 0) return ok(false);
  return bad(`merge-base exit ${r.code}: ${lastLine(r.stderr)}`);
}

function branchState(map, name) {
  if (!map.ok) return { name, read: map };
  const sha = map.value.get(name);
  if (!sha) return { name, read: bad(`branch ${name} absent on origin`) };
  const merged = mergedIntoMain(sha);
  return {
    name,
    read: merged.ok ? ok({ sha, merged: merged.value }) : merged,
  };
}

const describeBranch = b =>
  b.read.ok
    ? `\`${b.name}\` @ ${b.read.value.sha.slice(0, 12)}: ${b.read.value.merged ? 'merged into main' : 'NOT merged into main'}`
    : `\`${b.name}\`: no merge state — ${b.read.error}`;

// ---------------------------------------------------------------- classifiers (pure)

/** Combine: any definite failure -> FAIL; else any unreadable -> INCONCLUSIVE; else PASS. */
function verdict(failed, unreadable) {
  if (failed) return 'FAIL';
  if (unreadable) return 'INCONCLUSIVE';
  return 'PASS';
}

/**
 * G1. e = { phases: read<string[]>, receipts: [{ id, present: read<bool>,
 *   verify?: read<{ head, code, tail }> }], prs: read<[{number,headRefName,title}]> }
 */
export function classifyG1(e) {
  if (!e.phases.ok)
    return result('INCONCLUSIVE', [
      `policy phases unreadable: ${e.phases.error}`,
    ]);
  const ids = e.phases.value;
  const lines = [];
  const verified = [];
  const missing = [];
  const failing = [];
  const unreadable = [];
  for (const id of ids) {
    const r = e.receipts.find(x => x.id === id);
    if (!r || !r.present.ok) {
      unreadable.push(id);
      lines.push(
        `${id}: receipt presence unreadable (${r ? r.present.error : 'not checked'})`
      );
    } else if (!r.present.value) {
      missing.push(id);
      lines.push(`${id}: no release-receipts/${id}.json on ${MAIN}`);
    } else if (!r.verify || !r.verify.ok) {
      unreadable.push(id);
      lines.push(
        `${id}: receipted, verify-receipt could not run (${r.verify ? r.verify.error : 'not run'})`
      );
    } else if (r.verify.value.code !== 0) {
      failing.push(id);
      lines.push(
        `${id}: receipted, verify-receipt --head ${r.verify.value.head.slice(0, 12)} exit ${r.verify.value.code} — ${r.verify.value.tail}`
      );
    } else {
      verified.push(id);
      lines.push(
        `${id}: receipted, verify-receipt --head ${r.verify.value.head.slice(0, 12)} exit 0`
      );
    }
  }
  const receipted = ids.filter(
    id => !missing.includes(id) && !unreadable.includes(id)
  );
  const firstMissing = ids.find(
    id =>
      missing.includes(id) || failing.includes(id) || unreadable.includes(id)
  );
  const head = `${receipted.length} of ${ids.length} receipted (${receipted.join(', ') || 'none'}), ${verified.length} verify${firstMissing ? `, next: ${firstMissing}` : ''}`;
  if (ids.length !== 12)
    lines.push(`policy lists ${ids.length} phases, expected 12`);
  if (e.prs.disabled)
    lines.push(`open feature/fleet-* PRs: DISABLED (${e.prs.error})`);
  else if (!e.prs.ok)
    lines.push(`open feature/fleet-* PRs: INCONCLUSIVE (${e.prs.error})`);
  else {
    const prs = e.prs.value.filter(p =>
      String(p.headRefName).startsWith('feature/fleet-')
    );
    lines.push(
      `open feature/fleet-* PRs: ${prs.length}${prs.map(p => `\n  - #${p.number} \`${p.headRefName}\` ${p.title}`).join('')}`
    );
  }
  const state = verdict(
    missing.length > 0 || failing.length > 0 || ids.length !== 12,
    unreadable.length > 0
  );
  return result(state, [head, ...lines]);
}

/** G2. e = { policySha: read<hex>, recordedSha: read<hex>, halt: read<string[]>, today } */
export function classifyG2(e) {
  const lines = [];
  let failed = false;
  let unreadable = false;
  if (!e.policySha.ok || !e.recordedSha.ok) {
    unreadable = true;
    lines.push(
      `policy hash unreadable: ${[e.policySha, e.recordedSha]
        .filter(x => !x.ok)
        .map(x => x.error)
        .join('; ')}`
    );
  } else if (e.policySha.value !== e.recordedSha.value) {
    failed = true;
    lines.push(
      `policy.json sha256 ${e.policySha.value} != policy-hash.json ${e.recordedSha.value}`
    );
  } else
    lines.push(
      `policy.json sha256 matches policy-hash.json (${e.policySha.value})`
    );
  if (!e.halt.ok) {
    unreadable = true;
    lines.push(`halt dir unreadable: ${e.halt.error}`);
  } else {
    const stops = e.halt.value.filter(
      f => f === 'STOP' || f === `STOP-${e.today}`
    );
    if (stops.length) {
      failed = true;
      lines.push(
        `halt present on ${MAIN}: ${stops.map(s => `release-receipts/halt/${s}`).join(', ')}`
      );
    } else
      lines.push(`no release-receipts/halt/STOP or STOP-${e.today} on ${MAIN}`);
  }
  return result(verdict(failed, unreadable), lines);
}

/** Check one receipt's review report; returns a list of problems (empty = meets G3). */
export function reviewProblems(receipt, report) {
  const p = [];
  if (!['PASS', 'APPROVE'].includes(report.verdict))
    p.push(`verdict ${report.verdict}`);
  const head = report.head_sha ?? report.head ?? report.reviewed_head;
  const rc = String(receipt.reviewed_commit || '');
  if (typeof head !== 'string' || head.length < 7 || !rc.startsWith(head))
    p.push(`review head ${head} does not name reviewed_commit ${rc}`);
  if (!Array.isArray(report.blocking_findings))
    p.push('blocking_findings missing');
  else if (report.blocking_findings.length)
    p.push(`${report.blocking_findings.length} blocking finding(s)`);
  const reviewer = report.reviewer_agent ?? report.lane;
  if (typeof reviewer !== 'string' || !reviewer)
    p.push('no reviewer_agent/lane');
  else if (/^(claude|anthropic)/i.test(reviewer))
    p.push(`self-certified reviewer ${reviewer}`);
  return p;
}

/** G3. e = { receipts: read<[{ id, receipt: read<obj>, report: read<obj> }]> } */
export function classifyG3(e) {
  if (!e.receipts.ok)
    return result('INCONCLUSIVE', [
      `receipt list unreadable: ${e.receipts.error}`,
    ]);
  if (!e.receipts.value.length)
    return result('INCONCLUSIVE', [
      `no receipts on ${MAIN} to check — nothing proves or disproves the rule yet`,
    ]);
  const lines = [];
  let failed = false;
  let unreadable = false;
  for (const r of e.receipts.value) {
    if (!r.receipt.ok || !r.report.ok) {
      unreadable = true;
      lines.push(
        `${r.id}: ${!r.receipt.ok ? r.receipt.error : r.report.error}`
      );
      continue;
    }
    const probs = reviewProblems(r.receipt.value, r.report.value);
    if (probs.length) failed = true;
    const rep = r.report.value;
    lines.push(
      `${r.id}: ${probs.length ? `FAIL — ${probs.join('; ')}` : `independent review ${rep.verdict} by ${rep.reviewer_agent ?? rep.lane} on ${String(rep.head_sha ?? rep.head ?? rep.reviewed_head).slice(0, 12)}, 0 blocking`}`
    );
  }
  return result(verdict(failed, unreadable), lines);
}

/** Decision-table rows of DECISIONS.md: [{ id, line }]. */
export function decisionRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const id = (line.split('|')[1] || '').trim();
    if (/^[A-Z]+-\d+$/.test(id)) rows.push({ id, line });
  }
  return rows;
}

/** G4. e = { text: read<string> } */
export function classifyG4(e) {
  if (!e.text.ok)
    return result('INCONCLUSIVE', [`DECISIONS.md unreadable: ${e.text.error}`]);
  const rows = decisionRows(e.text.value);
  if (!rows.length)
    return result('INCONCLUSIVE', [
      'DECISIONS.md has no decision rows (table not found)',
    ]);
  const open = rows.filter(r => /\bOPEN\b/.test(r.line));
  return result('PASS', [
    `${open.length} OPEN row(s)${open.length ? `: ${open.map(r => r.id).join(', ')}` : ''} (${rows.length} rows scanned on ${MAIN})`,
  ]);
}

/** G5. e = { issue: read<{state,title}>, branches: read<string[]> } */
export function classifyG5(e) {
  if (e.issue.disabled && e.branches.disabled)
    return result('DISABLED', [`not run: ${e.issue.error}`]);
  const lines = [];
  let failed = false;
  let unreadable = false;
  if (!e.issue.ok) {
    unreadable = true;
    lines.push(`issue #999 unreadable: ${e.issue.error}`);
  } else {
    if (e.issue.value.state !== 'OPEN') failed = true;
    lines.push(`issue #999 ${e.issue.value.state}: ${e.issue.value.title}`);
  }
  if (!e.branches.ok) {
    unreadable = true;
    lines.push(`fleet-unit/* branches unreadable: ${e.branches.error}`);
  } else {
    if (!e.branches.value.length) failed = true;
    lines.push(
      `${e.branches.value.length} fleet-unit/* branch(es) on origin${e.branches.value.map(b => `\n  - \`${b}\``).join('')}`
    );
  }
  return result(verdict(failed, unreadable), lines);
}

/** G6. e = { disabled?: reason, branches: [{ name, read: read<{sha, merged}> }] } */
export function classifyG6(e) {
  if (e.disabled) return result('DISABLED', [`not run: ${e.disabled}`]);
  const unmerged = e.branches.filter(b => b.read.ok && !b.read.value.merged);
  const unreadable = e.branches.some(b => !b.read.ok);
  const lines = e.branches.map(describeBranch);
  if (unmerged.length)
    lines.unshift(`unmerged: ${unmerged.map(b => b.name).join(', ')}`);
  return result(verdict(unmerged.length > 0, unreadable), lines);
}

/** G7. e = { run: read<[{conclusion, headSha, databaseId}]>, sidecars: branchState, pr: read<{state,title}> } */
export function classifyG7(e) {
  if (e.run.disabled) return result('DISABLED', [`not run: ${e.run.error}`]);
  const lines = [];
  let state;
  if (!e.run.ok) {
    state = 'INCONCLUSIVE';
    lines.push(`Deploy run list unreadable: ${e.run.error}`);
  } else if (!Array.isArray(e.run.value) || !e.run.value.length) {
    state = 'INCONCLUSIVE';
    lines.push('no completed Deploy run on main found');
  } else {
    const r = e.run.value[0];
    state = r.conclusion === 'success' ? 'PASS' : 'FAIL';
    lines.push(
      `latest completed Deploy on main: run ${r.databaseId} conclusion ${r.conclusion} at ${String(r.headSha).slice(0, 12)}`
    );
  }
  lines.push(
    e.sidecars ? describeBranch(e.sidecars) : `\`${SIDECARS}\`: not checked`
  );
  lines.push(
    e.pr.ok
      ? `PR #1000 ${e.pr.value.state}: ${e.pr.value.title}`
      : `PR #1000 unreadable: ${e.pr.error}`
  );
  return result(state, lines);
}

const SUMMARY_RE =
  /^(\S+): (\d+) of (\d+) PASS, (\d+) FAIL, (\d+) INCONCLUSIVE, (\d+) DISABLED\b/m;

/**
 * State of one G8 command. A fleet script's own summary line outranks exit 0: a FAIL item
 * is FAIL, and a run with zero PASS items checked nothing (INCONCLUSIVE or DISABLED).
 * Scripts without that summary keep the exit-code rule.
 */
export function classifyCommand(run) {
  if (run.timedOut || run.spawnError || run.code === null)
    return {
      state: 'INCONCLUSIVE',
      why: run.timedOut ? 'timed out' : run.spawnError || 'no exit code',
    };
  if (run.code !== 0) return { state: 'FAIL', why: `exit ${run.code}` };
  // Every summary line counts and the worst one wins: a later all-PASS line must not
  // hide an earlier FAIL or nothing-checked line.
  const rank = { PASS: 0, DISABLED: 1, INCONCLUSIVE: 2, FAIL: 3 };
  let worst = { state: 'PASS', why: 'exit 0' };
  for (const l of String(run.output ?? run.tail ?? '').split('\n')) {
    const m = SUMMARY_RE.exec(l.trim());
    if (!m) continue;
    const s = classifySummary(m);
    if (rank[s.state] > rank[worst.state]) worst = s;
  }
  return worst;
}

function classifySummary(m) {
  const [n, total, f, i, d] = m.slice(2).map(Number);
  if (f > 0)
    return { state: 'FAIL', why: `exit 0 but summary reports ${f} FAIL` };
  if (total === 0)
    return {
      state: 'INCONCLUSIVE',
      why: 'exit 0 but summary reports 0 items — nothing checked',
    };
  if (total > 0 && n === 0) {
    if (i > 0)
      return {
        state: 'INCONCLUSIVE',
        why: `exit 0 but 0 of ${total} PASS, ${i} INCONCLUSIVE`,
      };
    if (d === total)
      return {
        state: 'DISABLED',
        why: `exit 0 but 0 of ${total} PASS, all DISABLED — nothing checked`,
      };
  }
  return { state: 'PASS', why: 'exit 0' };
}

/** G8. e = { cmds: [{ label, present: bool, reason?, run?: { code, timedOut, spawnError, tail, output? } }] } */
export function classifyG8(e) {
  const lines = [];
  const states = [];
  for (const c of e.cmds) {
    if (!c.present) {
      lines.push(`DISABLED \`${c.label}\` — ${c.reason}`);
      continue;
    }
    const s = classifyCommand(c.run);
    states.push({ label: c.label, state: s.state });
    lines.push(
      `${s.state} \`${c.label}\` ${s.why}${c.run.tail ? ` — ${c.run.tail}` : ''}`
    );
  }
  const of = st => states.filter(x => x.state === st).map(x => x.label);
  const failing = of('FAIL');
  if (failing.length) lines.unshift(`failing: ${failing.join(', ')}`);
  if (failing.length) return result('FAIL', lines);
  if (of('INCONCLUSIVE').length) return result('INCONCLUSIVE', lines);
  if (!of('PASS').length) return result('DISABLED', lines);
  // Some command PASS, some present command checked nothing: the finish line is not fully measured.
  if (of('DISABLED').length) {
    lines.unshift(`not measured: ${of('DISABLED').join(', ')}`);
    return result('INCONCLUSIVE', lines);
  }
  return result('PASS', lines);
}

// ---------------------------------------------------------------- collectors (I/O)

/**
 * Whether `file` exists at `ref`. ls-tree answers by exit code and stdout, so the result does not
 * depend on git's (locale-translated) stderr text. `run` is injectable for tests.
 */
export function receiptPresence(file, ref = MAIN, run = runRaw) {
  const c = run('git', ['ls-tree', '--name-only', ref, '--', file]);
  return c.code === 0
    ? ok(String(c.stdout).trim() === file)
    : bad(`ls-tree exit ${c.code}: ${lastLine(c.stderr)}`);
}

function collectG1(ctx) {
  const phases = parseJson(gitShow('scripts/fleet/policy.json'), 'policy.json');
  const ids = phases.ok
    ? ok((phases.value.phases || []).map(p => p.id))
    : phases;
  const receipts = (ids.ok ? ids.value : []).map(id => {
    const file = `release-receipts/${id}.json`;
    const present = receiptPresence(file);
    if (!present.ok || !present.value) return { id, present };
    const added = gitText([
      'log',
      '-1',
      '--format=%H',
      '--diff-filter=A',
      MAIN,
      '--',
      file,
    ]);
    const head = added.ok ? added.value.trim() : '';
    if (!head)
      return {
        id,
        present,
        verify: bad(
          added.ok ? 'commit that added the receipt not found' : added.error
        ),
      };
    const v = runRaw(
      process.execPath,
      ['scripts/release/verify-receipt.mjs', '--head', head, '--phase', id],
      { timeout: 300000 }
    );
    const verify =
      v.timedOut || v.spawnError || v.code === null
        ? bad(v.timedOut ? 'timed out' : v.spawnError || 'no exit code')
        : ok({
            head,
            code: v.code,
            tail: lastLine(v.stdout) || lastLine(v.stderr),
          });
    return { id, present, verify };
  });
  const prs = ctx.offline
    ? off('offline')
    : gh([
        'pr',
        'list',
        '--state',
        'open',
        '--limit',
        '500',
        '--json',
        'number,headRefName,title',
      ]);
  return classifyG1({ phases: ids, receipts, prs });
}

function collectG2() {
  const pol = gitShow('scripts/fleet/policy.json', true);
  const rec = parseJson(
    gitShow('release-receipts/manifests/policy-hash.json'),
    'policy-hash.json'
  );
  const halt = gitText([
    'ls-tree',
    '--name-only',
    MAIN,
    'release-receipts/halt/',
  ]);
  return classifyG2({
    policySha: pol.ok ? ok(sha256(pol.value)) : pol,
    recordedSha: rec.ok
      ? typeof rec.value.sha256 === 'string'
        ? ok(rec.value.sha256)
        : bad('policy-hash.json has no sha256')
      : rec,
    halt: halt.ok
      ? ok(
          halt.value
            .split('\n')
            .filter(Boolean)
            .map(f => path.posix.basename(f))
        )
      : halt,
    today: new Date().toISOString().slice(0, 10),
  });
}

function collectG3() {
  const ls = gitText(['ls-tree', '--name-only', MAIN, 'release-receipts/']);
  if (!ls.ok) return classifyG3({ receipts: ls });
  const files = ls.value
    .split('\n')
    .filter(f => /^release-receipts\/P(-1|\d+)\.json$/.test(f));
  return classifyG3({
    receipts: ok(
      files.map(f => {
        const id = path.posix.basename(f, '.json');
        const receipt = parseJson(gitShow(f), f);
        let report = bad('receipt unreadable');
        if (receipt.ok)
          report =
            typeof receipt.value.review_report === 'string'
              ? parseJson(
                  gitShow(receipt.value.review_report),
                  receipt.value.review_report
                )
              : bad('receipt names no review_report');
        return { id, receipt, report };
      })
    ),
  });
}

function collectG4() {
  return classifyG4({ text: gitShow('DECISIONS.md') });
}

function collectG5(ctx) {
  if (ctx.offline)
    return classifyG5({ issue: off('offline'), branches: off('offline') });
  const issue = gh(['issue', 'view', '999', '--json', 'state,title']);
  const heads = lsRemote(['refs/heads/fleet-unit/*']);
  return classifyG5({
    issue,
    branches: heads.ok
      ? ok([...heads.value.keys()].filter(b => b.startsWith('fleet-unit/')))
      : heads,
  });
}

function collectG6(ctx) {
  if (ctx.offline) return classifyG6({ disabled: 'offline', branches: [] });
  const map = lsRemote(HOTFIXES.map(b => `refs/heads/${b}`));
  return classifyG6({ branches: HOTFIXES.map(b => branchState(map, b)) });
}

function collectG7(ctx) {
  if (ctx.offline)
    return classifyG7({
      run: off('offline'),
      sidecars: null,
      pr: off('offline'),
    });
  const run = gh([
    'run',
    'list',
    '--workflow',
    'deploy.yml',
    '--branch',
    'main',
    '--status',
    'completed',
    '--limit',
    '1',
    '--json',
    'conclusion,headSha,databaseId',
  ]);
  const sidecars = branchState(lsRemote([`refs/heads/${SIDECARS}`]), SIDECARS);
  const pr = gh(['pr', 'view', '1000', '--json', 'state,title']);
  return classifyG7({ run, sidecars, pr });
}

function collectG8() {
  let pkgScripts = {};
  try {
    pkgScripts =
      JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
        .scripts || {};
  } catch {
    pkgScripts = null;
  }
  const node = (label, file, args) =>
    existsSync(path.join(ROOT, file))
      ? { label, present: true, cmd: process.execPath, args: [file, ...args] }
      : { label, present: false, reason: 'not on this checkout' };
  const cmds = [
    node(
      `node scripts/truth/check-noop.mjs --base ${NOOP_BASE}`,
      'scripts/truth/check-noop.mjs',
      ['--base', NOOP_BASE]
    ),
    pkgScripts === null
      ? {
          label: 'npm run jev:det',
          present: true,
          unreadable: 'package.json unreadable',
        }
      : pkgScripts['jev:det']
        ? {
            label: 'npm run jev:det',
            present: true,
            cmd: 'npm',
            args: ['run', 'jev:det'],
          }
        : {
            label: 'npm run jev:det',
            present: false,
            reason: 'package.json has no jev:det script on this checkout',
          },
    node(
      'node scripts/fleet/check-ledgers.mjs --days 14',
      'scripts/fleet/check-ledgers.mjs',
      ['--days', '14']
    ),
    node(
      'node scripts/release/verify-waterline.mjs',
      'scripts/release/verify-waterline.mjs',
      []
    ),
  ];
  for (const c of cmds) {
    if (!c.present) continue;
    if (c.unreadable) {
      c.run = { code: null, spawnError: c.unreadable };
      continue;
    }
    const r = runRaw(c.cmd, c.args, { timeout: 600000 });
    c.run = {
      code: r.code,
      timedOut: r.timedOut,
      spawnError: r.spawnError,
      tail: lastLine(r.stdout) || lastLine(r.stderr),
      output: `${r.stdout}\n${r.stderr}`,
    };
  }
  return classifyG8({ cmds });
}

// ---------------------------------------------------------------- template

/** Compare the template's bytes with the lock. Never throws; never writes. */
export function checkTemplate(templatePath, lockPath) {
  let lock;
  try {
    lock = JSON.parse(readOnly(lockPath).toString('utf8'));
  } catch (err) {
    return {
      ok: false,
      expected: '(lock unreadable)',
      actual: String(err.message),
    };
  }
  let actual;
  try {
    actual = sha256(readOnly(templatePath));
  } catch (err) {
    return {
      ok: false,
      expected: lock.sha256,
      actual: `(template unreadable: ${err.message})`,
    };
  }
  const okLock =
    typeof lock.sha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(lock.sha256) &&
    lock.template === TEMPLATE_REL;
  return {
    ok: okLock && lock.sha256 === actual,
    expected: okLock ? lock.sha256 : '(malformed lock)',
    actual,
  };
}

/** Single-pass fill: substituted values are never re-scanned. Every placeholder must be filled. */
export function fill(template, values) {
  for (const k of PLACEHOLDERS)
    if (!template.includes(`{{${k}}}`))
      throw new Error(`template lacks {{${k}}}`);
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`no value for {{${k}}}`);
    return String(values[k]);
  });
}

export function summarize(results) {
  const counts = Object.fromEntries(STATES.map(s => [s, 0]));
  for (const g of GOALS) counts[results[g].state]++;
  const firstFail = GOALS.find(g => results[g].state === 'FAIL');
  const next = firstFail
    ? `${firstFail} — ${results[firstFail].lines[0]}`
    : 'none (no goal is FAIL)';
  return `${STATES.map(s => `${s} ${counts[s]}`).join(' · ')}. Next blocking action: ${next}`;
}

export function render(template, results, meta) {
  const values = {
    GENERATED_AT: meta.generatedAt,
    MAIN_SHA: meta.mainSha,
    SUMMARY: summarize(results),
  };
  for (const g of GOALS) {
    values[`${g}_STATE`] = results[g].state;
    values[`${g}_EVIDENCE`] = results[g].lines.map(l => `- ${l}`).join('\n');
  }
  return fill(template, values);
}

/** True when <out> resolves (through symlinks) to the template. */
export function isTemplatePath(out, templatePath = TEMPLATE) {
  const real = p => {
    try {
      return realpathSync(p);
    } catch {
      try {
        return path.join(realpathSync(path.dirname(p)), path.basename(p));
      } catch {
        return path.resolve(p);
      }
    }
  };
  return real(path.resolve(out)) === real(templatePath);
}

// ---------------------------------------------------------------- control

const R = (code, extra = {}) => ({
  code,
  stdout: '',
  stderr: '',
  timedOut: false,
  spawnError: null,
  ...extra,
});

export function controls() {
  const out = [];
  const add = (name, caught) => out.push({ name, caught: Boolean(caught) });
  const tmp = mkdtempSync(path.join(tmpdir(), 'check-report-control-'));
  try {
    const tpl = path.join(tmp, 'check-report.template.md');
    const lockFile = path.join(tmp, 'template.lock.json');
    copyFileSync(TEMPLATE, tpl);
    const lock = JSON.parse(readOnly(LOCK).toString('utf8'));
    writeFileSync(lockFile, JSON.stringify(lock));
    add(
      'template guard accepts an unchanged copy (positive control)',
      checkTemplate(tpl, lockFile).ok
    );
    writeFileSync(tpl, Buffer.concat([readOnly(TEMPLATE), Buffer.from(' ')]));
    add(
      'template guard rejects a planted changed copy',
      !checkTemplate(tpl, lockFile).ok
    );
    rmSync(tpl);
    add(
      'template guard rejects a missing template',
      !checkTemplate(tpl, lockFile).ok
    );
    writeFileSync(lockFile, '{not json');
    add(
      'template guard rejects an unreadable lock',
      !checkTemplate(TEMPLATE, lockFile).ok
    );
    const link = path.join(tmp, 'alias.md');
    symlinkSync(TEMPLATE, link);
    add(
      '--out refuses the template path and a symlink to it',
      isTemplatePath(TEMPLATE) &&
        isTemplatePath(link) &&
        !isTemplatePath(path.join(tmp, 'report.md'))
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  add(
    'gh non-zero exit classifies INCONCLUSIVE, not an empty list',
    !classifyGhRead(R(1, { stdout: '[]', stderr: 'HTTP 502' })).ok
  );
  add(
    'gh timeout classifies INCONCLUSIVE',
    !classifyGhRead(R(null, { timedOut: true })).ok
  );
  add(
    'gh non-JSON output classifies INCONCLUSIVE',
    !classifyGhRead(R(0, { stdout: 'oops' })).ok
  );
  add(
    'gh exit 0 with JSON [] is a successful empty read (positive control)',
    classifyGhRead(R(0, { stdout: '[]' })).ok
  );

  const ids = [
    'P-1',
    'P0',
    'P1',
    'P2',
    'P3',
    'P4',
    'P5',
    'P6',
    'P7',
    'P8',
    'P9',
    'P10',
  ];
  const allGood = ids.map(id => ({
    id,
    present: ok(true),
    verify: ok({ head: 'a'.repeat(40), code: 0, tail: '' }),
  }));
  const prs = ok([]);
  add(
    'G1 all 12 receipted and verified is PASS (positive control)',
    classifyG1({ phases: ok(ids), receipts: allGood, prs }).state === 'PASS'
  );
  const g1 = classifyG1({
    phases: ok(ids),
    receipts: allGood.map((r, i) => (i ? { id: r.id, present: ok(false) } : r)),
    prs,
  });
  add(
    'G1 1 of 12 receipted is FAIL naming next P0',
    g1.state === 'FAIL' &&
      g1.lines[0].includes('1 of 12') &&
      g1.lines[0].includes('next: P0')
  );
  add(
    'G1 verify-receipt exit 1 is FAIL',
    classifyG1({
      phases: ok(ids),
      receipts: allGood.map((r, i) =>
        i
          ? r
          : { ...r, verify: ok({ head: 'a'.repeat(40), code: 1, tail: 'x' }) }
      ),
      prs,
    }).state === 'FAIL'
  );
  add(
    'G1 unreadable policy is INCONCLUSIVE',
    classifyG1({ phases: bad('x'), receipts: [], prs }).state === 'INCONCLUSIVE'
  );

  const h = 'f'.repeat(64);
  add(
    'G2 matching hash and no halt is PASS (positive control)',
    classifyG2({
      policySha: ok(h),
      recordedSha: ok(h),
      halt: ok([]),
      today: '2026-01-01',
    }).state === 'PASS'
  );
  add(
    'G2 hash mismatch is FAIL',
    classifyG2({
      policySha: ok(h),
      recordedSha: ok('0'.repeat(64)),
      halt: ok([]),
      today: '2026-01-01',
    }).state === 'FAIL'
  );
  add(
    'G2 STOP-<today> is FAIL',
    classifyG2({
      policySha: ok(h),
      recordedSha: ok(h),
      halt: ok(['STOP-2026-01-01']),
      today: '2026-01-01',
    }).state === 'FAIL'
  );
  add(
    'G2 unreadable halt dir is INCONCLUSIVE',
    classifyG2({
      policySha: ok(h),
      recordedSha: ok(h),
      halt: bad('x'),
      today: '2026-01-01',
    }).state === 'INCONCLUSIVE'
  );

  const rc = 'abcdef1234567890abcdef1234567890abcdef12';
  const good = {
    verdict: 'PASS',
    head_sha: rc,
    blocking_findings: [],
    reviewer_agent: 'openrouter/kimi',
  };
  const g3 = rep =>
    classifyG3({
      receipts: ok([
        { id: 'P-1', receipt: ok({ reviewed_commit: rc }), report: ok(rep) },
      ]),
    }).state;
  add(
    'G3 independent PASS review is PASS (positive control)',
    g3(good) === 'PASS'
  );
  add(
    'G3 claude reviewer (self-certification) is FAIL',
    g3({ ...good, reviewer_agent: 'claude-opus' }) === 'FAIL'
  );
  add(
    'G3 review on another head is FAIL',
    g3({ ...good, head_sha: '1234567' }) === 'FAIL'
  );
  add(
    'G3 blocking finding is FAIL',
    g3({ ...good, blocking_findings: ['x'] }) === 'FAIL'
  );
  add(
    'G3 no receipts is INCONCLUSIVE, not PASS',
    classifyG3({ receipts: ok([]) }).state === 'INCONCLUSIVE'
  );

  add(
    'G4 unreadable DECISIONS.md is INCONCLUSIVE',
    classifyG4({ text: bad('x') }).state === 'INCONCLUSIVE'
  );
  add(
    'G4 text without a decision table is INCONCLUSIVE',
    classifyG4({ text: ok('# empty\n') }).state === 'INCONCLUSIVE'
  );
  const g4 = classifyG4({
    text: ok('| ID | Kind |\n| D-1 | OPEN | x |\n| D-2 | open | y |\n'),
  });
  add(
    'G4 lists only case-sensitive OPEN rows (positive control)',
    g4.state === 'PASS' && g4.lines[0].startsWith('1 OPEN row(s): D-1')
  );

  add(
    'G5 open issue and a branch is PASS (positive control)',
    classifyG5({
      issue: ok({ state: 'OPEN', title: 't' }),
      branches: ok(['fleet-unit/a']),
    }).state === 'PASS'
  );
  add(
    'G5 closed issue is FAIL',
    classifyG5({
      issue: ok({ state: 'CLOSED', title: 't' }),
      branches: ok(['fleet-unit/a']),
    }).state === 'FAIL'
  );
  add(
    'G5 gh failure is INCONCLUSIVE',
    classifyG5({ issue: classifyGhRead(R(1)), branches: ok(['fleet-unit/a']) })
      .state === 'INCONCLUSIVE'
  );
  add(
    'G5 offline is DISABLED',
    classifyG5({ issue: off('offline'), branches: off('offline') }).state ===
      'DISABLED'
  );

  const br = (name, merged) => ({
    name,
    read: ok({ sha: 'a'.repeat(40), merged }),
  });
  add(
    'G6 three merged is PASS (positive control)',
    classifyG6({ branches: HOTFIXES.map(b => br(b, true)) }).state === 'PASS'
  );
  add(
    'G6 one unmerged is FAIL',
    classifyG6({ branches: HOTFIXES.map((b, i) => br(b, i > 0)) }).state ===
      'FAIL'
  );
  add(
    'G6 unreadable branch is INCONCLUSIVE',
    classifyG6({
      branches: [
        br(HOTFIXES[0], true),
        br(HOTFIXES[1], true),
        { name: HOTFIXES[2], read: bad('absent') },
      ],
    }).state === 'INCONCLUSIVE'
  );

  const pr = ok({ state: 'OPEN', title: 't' });
  add(
    'G7 success is PASS (positive control)',
    classifyG7({
      run: ok([{ conclusion: 'success', headSha: 'a', databaseId: 1 }]),
      sidecars: null,
      pr,
    }).state === 'PASS'
  );
  add(
    'G7 failure conclusion is FAIL',
    classifyG7({
      run: ok([{ conclusion: 'failure', headSha: 'a', databaseId: 1 }]),
      sidecars: null,
      pr,
    }).state === 'FAIL'
  );
  add(
    'G7 gh failure is INCONCLUSIVE',
    classifyG7({
      run: classifyGhRead(R(4, { stderr: 'auth' })),
      sidecars: null,
      pr,
    }).state === 'INCONCLUSIVE'
  );
  add(
    'G7 empty run list is INCONCLUSIVE',
    classifyG7({ run: ok([]), sidecars: null, pr }).state === 'INCONCLUSIVE'
  );

  const cmd = (code, extra = {}) => ({
    label: 'c',
    present: true,
    run: { code, tail: '', ...extra },
  });
  add(
    'G8 every present command exit 0 is PASS (positive control)',
    classifyG8({ cmds: [cmd(0), { label: 'm', present: false, reason: 'r' }] })
      .state === 'PASS'
  );
  add(
    'G8 non-zero exit is FAIL',
    classifyG8({ cmds: [cmd(0), cmd(1)] }).state === 'FAIL'
  );
  add(
    'G8 timeout is INCONCLUSIVE',
    classifyG8({ cmds: [cmd(null, { timedOut: true })] }).state ===
      'INCONCLUSIVE'
  );
  add(
    'G8 no command present is DISABLED',
    classifyG8({ cmds: [{ label: 'm', present: false, reason: 'r' }] })
      .state === 'DISABLED'
  );
  const run0 = output => ({ code: 0, tail: '', output });
  add(
    "exit 0 + '0 of 2 PASS ... 2 DISABLED' summary is DISABLED, not PASS",
    classifyCommand(
      run0('check-ledgers: 0 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 2 DISABLED')
    ).state === 'DISABLED'
  );
  add(
    "exit 0 + '1 of 3 PASS, 1 FAIL' summary is FAIL",
    classifyCommand(run0('x: 1 of 3 PASS, 1 FAIL, 0 INCONCLUSIVE, 1 DISABLED'))
      .state === 'FAIL'
  );
  add(
    "exit 0 + '0 of 2 PASS, 1 INCONCLUSIVE' summary is INCONCLUSIVE",
    classifyCommand(run0('x: 0 of 2 PASS, 0 FAIL, 1 INCONCLUSIVE, 1 DISABLED'))
      .state === 'INCONCLUSIVE'
  );
  add(
    "exit 0 + '0 of 0 PASS' summary is INCONCLUSIVE, not PASS",
    classifyCommand(run0('x: 0 of 0 PASS, 0 FAIL, 0 INCONCLUSIVE, 0 DISABLED'))
      .state === 'INCONCLUSIVE'
  );
  add(
    'exit 0 without a summary is PASS (positive control)',
    classifyCommand(run0('verify-waterline: 0 events, 0 fleet-authored'))
      .state === 'PASS'
  );
  add(
    'G8 with one PASS and one all-DISABLED command is not PASS',
    classifyG8({
      cmds: [
        { label: 'a', present: true, run: run0('ok') },
        {
          label: 'b',
          present: true,
          run: run0('b: 0 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 2 DISABLED'),
        },
      ],
    }).state !== 'PASS'
  );

  let threw = false;
  try {
    result('PASSISH', []);
  } catch {
    threw = true;
  }
  add('a fifth state is rejected', threw);
  threw = false;
  try {
    fill('{{GENERATED_AT}}', { GENERATED_AT: 'x' });
  } catch {
    threw = true;
  }
  add('fill rejects a template missing placeholders', threw);
  const tplText = readOnly(TEMPLATE).toString('utf8');
  const filled = fill(
    tplText,
    Object.fromEntries(
      PLACEHOLDERS.map(k => [k, k === 'SUMMARY' ? '{{G1_STATE}}' : 'v'])
    )
  );
  add(
    'fill is single-pass (a value holding {{...}} is not re-substituted)',
    filled.includes('**Summary:** {{G1_STATE}}') &&
      !/\{\{(?!G1_STATE\}\})[A-Z0-9_]+\}\}/.test(filled)
  );
  return out;
}

// ---------------------------------------------------------------- main

function argValue(args, k) {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
}

export function main(args) {
  const guard = checkTemplate(TEMPLATE, LOCK);
  if (!guard.ok) {
    console.log(`FAIL template changed: ${guard.expected} != ${guard.actual}`);
    return 2;
  }
  if (args.includes('--control')) {
    const cs = controls();
    for (const c of cs)
      console.log(`${c.caught ? 'PASS' : 'FAIL'} control: ${c.name}`);
    const missed = cs.filter(c => !c.caught).length;
    console.log(
      `check-report --control: ${cs.length - missed} of ${cs.length} caught`
    );
    return missed ? 2 : 0;
  }
  const out = argValue(args, '--out');
  if (args.includes('--out') && !out) {
    console.error('FAIL --out needs a path');
    return 2;
  }
  if (out && isTemplatePath(out)) {
    console.error(`FAIL --out ${out} resolves to the template; refused`);
    return 2;
  }
  const ctx = { offline: args.includes('--offline') };
  let gitBlocked = null;
  if (!ctx.offline) {
    const f = runRaw('git', ['fetch', '--quiet', 'origin', 'main'], {
      timeout: 180000,
    });
    if (f.code !== 0)
      gitBlocked = `git fetch origin main failed (${f.timedOut ? 'timeout' : lastLine(f.stderr)}); origin/main may be stale`;
  }
  const mainSha = gitText(['rev-parse', '--verify', `${MAIN}^{commit}`]);
  if (!mainSha.ok)
    gitBlocked = gitBlocked || `${MAIN} does not resolve: ${mainSha.error}`;

  const collectors = {
    G1: collectG1,
    G2: collectG2,
    G3: collectG3,
    G4: collectG4,
    G5: collectG5,
    G6: collectG6,
    G7: collectG7,
    G8: collectG8,
  };
  const needsMain = new Set(['G1', 'G2', 'G3', 'G4', 'G6', 'G7']);
  const results = {};
  for (const g of GOALS) {
    if (
      gitBlocked &&
      needsMain.has(g) &&
      !(ctx.offline && ['G6', 'G7'].includes(g))
    )
      results[g] = result('INCONCLUSIVE', [gitBlocked]);
    else results[g] = collectors[g](ctx);
  }
  const report = render(readOnly(TEMPLATE).toString('utf8'), results, {
    generatedAt: new Date().toISOString(),
    mainSha: mainSha.ok
      ? `${mainSha.value.trim()}${ctx.offline ? ' (offline: as of last fetch)' : ''}`
      : 'unresolved',
  });
  const after = checkTemplate(TEMPLATE, LOCK);
  if (!after.ok) {
    console.log(
      `FAIL template changed during run: ${after.expected} != ${after.actual}`
    );
    return 2;
  }
  process.stdout.write(report);
  if (out) writeFileSync(out, report);
  if (args.includes('--strict') && GOALS.some(g => results[g].state !== 'PASS'))
    return 1;
  return 0;
}

function isMain() {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1] || '')
    );
  } catch {
    return false;
  }
}

if (isMain()) {
  let code;
  try {
    code = main(process.argv.slice(2));
  } catch (err) {
    console.log(`FAIL internal: ${err && err.stack ? err.stack : err}`);
    code = 2;
  }
  process.exitCode = code;
}
