#!/usr/bin/env node
/**
 * scripts/fleet/apply-proposals.mjs --phase P<n> [--dry-run]
 * Moves proposals/<phase>/<path> into place and deletes the staging directory (rule B2).
 * Under FD-3 the orchestrator runs this as a separate follow-up branch after the phase merges;
 * the commit carries trailer Fleet-Role: orchestrator and Waterline-Act: apply-proposals and is
 * recorded in the ledger as a waterline act. It never runs inside a phase branch.
 */
import { ROOT, ledgerAppend, tryGit } from './lib.mjs';
import {
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
const pi = a.indexOf('--phase');
const phase = pi >= 0 ? a[pi + 1] : null;
const dry = a.includes('--dry-run');
if (!phase) {
  console.error('usage: --phase P<n> [--dry-run]');
  process.exit(2);
}
const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || '';
if (/^feature\/fleet-p/.test(branch) && !dry) {
  console.log(
    `FAIL apply-proposals: refuses to run on a phase branch (${branch})`
  );
  process.exit(1);
}
const src = path.join(ROOT, 'proposals', phase);
if (!existsSync(src)) {
  console.log(`DISABLED apply-proposals: no proposals for ${phase}`);
  process.exit(0);
}
function walk(d) {
  return readdirSync(d).flatMap(f => {
    const p = path.join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(src);
for (const f of files) {
  const rel = path.relative(src, f);
  const dest = path.join(ROOT, rel);
  console.log(
    `${dry ? 'would move' : 'move'} proposals/${phase}/${rel} -> ${rel}`
  );
  if (!dry) {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(f, dest);
  }
}
if (!dry) {
  rmSync(src, { recursive: true, force: true });
  ledgerAppend({
    kind: 'waterline',
    event: 'apply-proposals',
    phase,
    files: files.length,
    actor_is_fleet: true,
    ratified_by: 'FD-3',
  });
}
console.log(
  `PASS apply-proposals ${phase}: ${files.length} file(s)${dry ? ' (dry run)' : ''}`
);
