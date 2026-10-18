#!/usr/bin/env node
/**
 * scripts/fleet/lib.mjs — shared helpers for the Synthex fleet (protected path).
 *
 * Rule 5 of the spec: four states, never three. Every result is PASS, FAIL,
 * INCONCLUSIVE (could not run) or DISABLED (lane or credential missing, run
 * finished without it). INCONCLUSIVE never counts as a pass.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  mkdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATES = Object.freeze([
  'PASS',
  'FAIL',
  'INCONCLUSIVE',
  'DISABLED',
]);
export const ROOT = findRoot();

function findRoot() {
  let d = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(path.join(d, 'scripts/fleet/policy.json')) &&
      existsSync(path.join(d, 'package.json'))
    )
      return d;
    const p = path.dirname(d);
    if (p === d) break;
    d = p;
  }
  return process.cwd();
}

export function policy() {
  return JSON.parse(
    readFileSync(path.join(ROOT, 'scripts/fleet/policy.json'), 'utf8')
  );
}
export function policyHash() {
  return sha256(readFileSync(path.join(ROOT, 'scripts/fleet/policy.json')));
}
export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
export function readJson(p, fallback) {
  const f = path.isAbsolute(p) ? p : path.join(ROOT, p);
  if (!existsSync(f)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing ${p}`);
  }
  return JSON.parse(readFileSync(f, 'utf8'));
}
export function writeJson(p, obj) {
  const f = path.isAbsolute(p) ? p : path.join(ROOT, p);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(obj, null, 2) + '\n');
}
export function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
export function tryGit(args, opts = {}) {
  try {
    return git(args, opts);
  } catch (e) {
    return null;
  }
}
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeout,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  return {
    code: r.status === null ? 124 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    signal: r.signal,
  };
}
export function sh(cmdline, opts = {}) {
  const r = spawnSync('bash', ['-lc', cmdline], {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status === null ? 124 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

/** Minimal glob: ** matches any path segment run, * matches within a segment. */
export function globToRegExp(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if ('.+?^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(re + '$');
}
export function isProtected(file, pol = policy()) {
  return pol.protected_paths.some(g => globToRegExp(g).test(file));
}
// No rename detection (a protected file renamed out of a protected dir must show its old path),
// unquoted paths (core.quotePath quoted non-ASCII names past the protected globs) and NUL
// separators (verifier audit).
export function changedFiles(base, head = 'HEAD', cwd = ROOT) {
  const args = d => [
    '-c',
    'core.quotePath=false',
    'diff',
    '--no-renames',
    '--name-only',
    '-z',
    ...d,
  ];
  const out =
    tryGit(args([`${base}...${head}`]), { cwd }) ??
    git(args([base, head]), { cwd });
  return out ? out.split('\0').filter(Boolean) : [];
}
export function commitTrailers(sha, cwd = ROOT) {
  const body = git(['show', '-s', '--format=%B', sha], { cwd });
  const t = {};
  for (const line of body.split('\n')) {
    const m = /^([A-Za-z-]+):\s*(.+)$/.exec(line.trim());
    if (m) t[m[1]] = m[2];
  }
  return t;
}
// A fleet commit has the fleet committer AND a Fleet-Role trailer naming a real role. Either one
// alone used to suffice, so any author could attest a human commit as AI-only with
// "Fleet-Role: none-really" (verifier audit). Both remain forgeable by someone with push access;
// a signed-commit trust root is DECISIONS.md OPEN-4.
export function isFleetCommit(sha, pol = policy(), cwd = ROOT) {
  const email = git(['show', '-s', '--format=%ce', sha], { cwd });
  if (email !== pol.committer.email) return false;
  const role = commitTrailers(sha, cwd)[pol.committer.trailer];
  if (Object.prototype.hasOwnProperty.call(pol.roles || {}, String(role || '')))
    return true;
  // run-phase integrate's merge commits carry git's default message (no trailer); a fleet-committed
  // merge still counts. Its content is checked as a pure merge elsewhere.
  const parents = git(['show', '-s', '--format=%P', sha], { cwd })
    .split(' ')
    .filter(Boolean);
  if (parents.length < 2) return false;
  // Only a pure merge: no path differs from every parent (no evil merge content). diff-tree --cc
  // lists exactly those paths (verifier audit second pass: an evil merge attested as AI-only).
  const evil = tryGit(
    ['diff-tree', '--cc', '--no-commit-id', '--name-only', sha],
    { cwd }
  );
  return evil === '';
}
export function utcDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
export function ledgerAppend(row, file) {
  const pol = policy();
  const f = path.join(ROOT, file || pol.ledger);
  mkdirSync(path.dirname(f), { recursive: true });
  appendFileSync(
    f,
    JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n'
  );
}
// The live ledger ref, resolved once per process: undefined = not yet read, null = absent on origin.
let ledgerLive;
export class LedgerUnreadableError extends Error {}
// The ledger must be read at the SHA origin reports live. ls-remote failing, a failed fetch, or a
// fetch landing elsewhere throws, never falls back to a stale local copy (Codex on P2 d6e10e5e: a
// remote human-intervention row hidden by a failed fetch let attestation pass). An empty ls-remote
// means the ref does not exist yet: no remote rows.
export function liveLedgerSha({ lsCode, lsOut, fetchCode, fetchedSha }) {
  if (lsCode !== 0)
    throw new LedgerUnreadableError('ledger ref: ls-remote failed');
  const live = (lsOut || '').trim().split(/\s/)[0] || '';
  if (!live) return null;
  if (!/^[0-9a-f]{40}$/.test(live) || fetchCode !== 0 || fetchedSha !== live)
    throw new LedgerUnreadableError(
      'ledger ref: not freshly fetched at its live SHA'
    );
  return live;
}
// at: read the ledger committed at that ref instead of the working tree (attest-phase judges a head,
// never uncommitted edits; verifier audit second pass).
export function ledgerRows(file, at = null) {
  const pol = policy();
  const rel = file || pol.ledger;
  const f = path.join(ROOT, rel);
  const parse = txt =>
    txt
      .split('\n')
      .filter(Boolean)
      .map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return { kind: 'CORRUPT', raw: l };
        }
      });
  const atRef = at ? tryGit(['show', `${at}:${rel}`]) : null;
  if (at && atRef === null)
    throw new LedgerUnreadableError(`ledger: ${rel} unreadable at ${at}`);
  const local = at
    ? parse(atRef)
    : existsSync(f)
      ? parse(readFileSync(f, 'utf8'))
      : [];
  // Rows written by scheduled runs live on the ref refs/fleet/ledger (see ledger-push.mjs), fetched
  // once per process; rows from the retired fleet-ledger branch are still read.
  const ref = pol.ledger_ref || 'refs/fleet/ledger';
  if (ledgerLive === undefined) {
    const ls = run('git', ['ls-remote', 'origin', ref]);
    const fetched =
      ls.code === 0 && ls.stdout.trim()
        ? run('git', ['fetch', '-q', 'origin', `+${ref}:${ref}`])
        : { code: 0 };
    ledgerLive = liveLedgerSha({
      lsCode: ls.code,
      lsOut: ls.stdout,
      fetchCode: fetched.code,
      fetchedSha: tryGit(['rev-parse', '--verify', '-q', ref]) || '',
    });
  }
  let liveTxt = null;
  if (ledgerLive) {
    liveTxt = tryGit(['show', `${ledgerLive}:${rel}`]);
    if (liveTxt === null)
      throw new LedgerUnreadableError(`ledger ref: ${rel} unreadable`);
  }
  const remote = [
    liveTxt,
    tryGit(['show', `origin/fleet-ledger:${rel}`]),
  ].filter(Boolean);
  const rows = [...remote.flatMap(parse), ...local];
  const seen = new Set();
  return rows
    .filter(r => {
      const k = JSON.stringify(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
}
export function haltState() {
  const pol = policy();
  const dir = path.join(ROOT, pol.halt_dir);
  const security = existsSync(path.join(dir, 'STOP'));
  const daily = existsSync(path.join(dir, `STOP-${utcDate()}`));
  return { security, daily, halted: security || daily };
}
export function assertState(s) {
  if (!STATES.includes(s)) throw new Error(`fifth state rejected: ${s}`);
  return s;
}
/** Print one PASS/FAIL/INCONCLUSIVE/DISABLED line per item, return overall exit code. */
export function report(name, items) {
  let fail = 0,
    inc = 0,
    dis = 0;
  for (const it of items) {
    assertState(it.state);
    console.log(
      `${it.state.padEnd(12)} ${name}: ${it.id} — ${it.text}${it.detail ? ' [' + String(it.detail).replace(/\s+/g, ' ').slice(0, 200) + ']' : ''}`
    );
    if (it.state === 'FAIL') fail++;
    if (it.state === 'INCONCLUSIVE') inc++;
    if (it.state === 'DISABLED') dis++;
  }
  console.log(
    `${name}: ${items.length - fail - inc - dis} of ${items.length} PASS, ${fail} FAIL, ${inc} INCONCLUSIVE, ${dis} DISABLED`
  );
  return fail ? 1 : inc ? 2 : 0;
}
export function nodeVersionOk(floor) {
  const [a, b, c] = process.versions.node.split('.').map(Number);
  const [x, y, z] = floor.split('.').map(Number);
  return a > x || (a === x && (b > y || (b === y && c >= z)));
}

/** True when this module is the entry script. Compares real paths, so a repository path with spaces
 *  (the Mac Mini SSD) still runs the CLI body (independent review r3, B-1). */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(metaUrl) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
}
