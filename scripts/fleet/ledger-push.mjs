#!/usr/bin/env node
/**
 * scripts/fleet/ledger-push.mjs --row '<json>' [--row ...]
 * Appends rows to release-receipts/ledger/fleet.jsonl on the ref refs/fleet/ledger (a ref, not a
 * branch, so GitHub never offers a pull request for it)
 * and pushes it. Scheduled runs (nightly, weekly, phase-advance) use this because main accepts
 * no direct push; the ledger branch is read by ledgerRows() in every check. Never touches main.
 */
import { policy, git, tryGit, run, ROOT } from './lib.mjs';
import { mkdtempSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const pol = policy();
const ref = pol.ledger_ref || 'refs/fleet/ledger';
const rows = [];
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++)
  if (a[i] === '--row') rows.push(JSON.parse(a[++i]));
if (!rows.length) {
  console.error('usage: --row <json> [--row <json>...]');
  process.exit(2);
}
git(['fetch', '-q', 'origin']);
tryGit(['fetch', '-q', 'origin', `+${ref}:${ref}`]);
const wt = mkdtempSync(path.join(tmpdir(), 'ledger-'));
const has = tryGit(['rev-parse', '--verify', '-q', ref]);
run('git', [
  'worktree',
  'add',
  '-q',
  '--detach',
  wt,
  has ? ref : 'origin/main',
]);
const f = path.join(wt, pol.ledger);
mkdirSync(path.dirname(f), { recursive: true });
for (const r of rows)
  appendFileSync(
    f,
    JSON.stringify({ ts: new Date().toISOString(), ...r }) + '\n'
  );
git(['add', '--', pol.ledger], { cwd: wt });
git(
  [
    '-c',
    `user.name=${pol.committer.name}`,
    '-c',
    `user.email=${pol.committer.email}`,
    'commit',
    '-q',
    '-m',
    `chore(fleet): ledger rows\n\nFleet-Role: scheduler`,
  ],
  { cwd: wt }
);
const p = run('git', ['push', '-q', 'origin', `HEAD:${ref}`], {
  cwd: wt,
});
run('git', ['worktree', 'remove', '--force', wt]);
if (p.code !== 0) {
  console.log(`FAIL ledger-push: ${p.stderr.trim().slice(0, 200)}`);
  process.exit(1);
}
console.log(`PASS ledger-push: ${rows.length} row(s) to ${ref}`);
