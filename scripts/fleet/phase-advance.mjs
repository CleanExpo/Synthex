#!/usr/bin/env node
/**
 * scripts/fleet/phase-advance.mjs [--dry-run]
 * Rule B5 on the Cloudroom substrate. Run by the fleet-phase-advance automation in a fresh thread.
 * Fetches origin/main, finds the lowest phase whose release-receipts/P<n>.json is absent, and
 * prints `START P<n>` only when: the previous phase's receipt is on origin/main and verify-receipt
 * exits 0 for it (for P0: check-bootstrap exits 0 instead); no branch feature/fleet-p<n>-* exists
 * on the remote (the run lock); no hold row for P<n> today; no halt file. Otherwise prints
 * `HOLD <reason>` and exits 3. The automation's thread then acts as the orchestrator for that phase
 * (scripts/fleet/README.md). Every evaluation writes one ledger row via ledger-push.mjs.
 */
import {
  policy,
  git,
  tryGit,
  run,
  ledgerRows,
  haltState,
  utcDate,
  ROOT,
} from './lib.mjs';
const pol = policy();
const dry = process.argv.includes('--dry-run');
git(['fetch', '-q', 'origin']);
const h = haltState();
const rows = ledgerRows();
let decision = null,
  reason = null,
  phase = null;
for (const ph of pol.phases) {
  const receipt = tryGit([
    'cat-file',
    '-e',
    `origin/main:release-receipts/${ph.id}.json`,
  ]);
  if (receipt !== null) continue;
  phase = ph.id;
  const prev = pol.phases[pol.phases.indexOf(ph) - 1];
  if (h.halted) {
    reason = h.security ? 'security STOP' : 'daily ceiling halt';
    break;
  }
  if (prev) {
    const v = run(process.execPath, [
      'scripts/release/verify-receipt.mjs',
      '--head',
      'origin/main',
      '--phase',
      prev.id,
    ]);
    if (v.code !== 0) {
      reason = `previous receipt ${prev.id} invalid: ${v.stdout.trim().split('\n').pop()}`;
      break;
    }
  } else {
    const b = run(process.execPath, ['scripts/fleet/check-bootstrap.mjs']);
    if (b.code !== 0) {
      reason = 'check-bootstrap not 0';
      break;
    }
  }
  const lock = (
    tryGit([
      'ls-remote',
      '--heads',
      'origin',
      `feature/fleet-${ph.id.toLowerCase()}-*`,
    ]) || ''
  ).trim();
  if (lock) {
    reason = `run lock: remote branch ${lock.split('\t').pop()}`;
    break;
  }
  const hold = rows.find(
    r =>
      r.kind === 'hold' &&
      r.phase === ph.id &&
      String(r.ts).startsWith(utcDate())
  );
  if (hold) {
    reason = `held today: ${hold.cause}`;
    break;
  }
  decision = 'START';
  break;
}
if (!phase) {
  console.log('DONE all phases have receipts on origin/main');
  process.exit(0);
}
const line = decision ? `START ${phase}` : `HOLD ${phase}: ${reason}`;
if (!dry)
  run(process.execPath, [
    'scripts/fleet/ledger-push.mjs',
    '--row',
    JSON.stringify({
      kind: 'start',
      phase,
      decision: decision || 'HOLD',
      reason,
      source: 'phase-advance',
    }),
  ]);
console.log(line);
process.exit(decision ? 0 : 3);
