#!/usr/bin/env node
/**
 * scripts/fleet/attest-phase.mjs --phase P<n> [--base origin/main] [--control]
 * Reads the run ledger and the git log for the phase branch and exits non-zero if the phase
 * claims AI-only and any commit on the branch is human-authored (not a fleet commit), any
 * ledger row records a human intervention, or any receipt carries a fifth state.
 * Waterline acts recorded with kind 'waterline' are listed and do not count.
 */
import {
  policy,
  ledgerRows,
  tryGit,
  git,
  isFleetCommit,
  STATES,
  readJson,
  report,
  isMain,
} from './lib.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : d;
};
export function evaluate({ commits, rows, receipt, corrupt = 0 }) {
  const items = [];
  const human = commits.filter(c => !c.fleet);
  items.push({
    id: 'commits',
    text: `${commits.length} commits on the phase branch, ${human.length} human-authored`,
    state: human.length ? 'FAIL' : 'PASS',
    detail: human.map(c => c.sha.slice(0, 12)).join(','),
  });
  const interventions = rows.filter(r => r.kind === 'human-intervention');
  // An unreadable ledger row could be a human-intervention row someone corrupted: never a PASS.
  items.push({
    id: 'interventions',
    text: `${interventions.length} human interventions in the ledger${corrupt ? `, ${corrupt} unreadable row(s)` : ''}`,
    state: interventions.length || corrupt ? 'FAIL' : 'PASS',
  });
  const states = [
    receipt?.state,
    ...(receipt?.gate || []).map(g => g.state),
  ].filter(Boolean);
  const fifth = states.filter(s => !STATES.includes(s));
  items.push({
    id: 'states',
    text: 'receipt carries only the four states',
    state: fifth.length ? 'FAIL' : receipt ? 'PASS' : 'INCONCLUSIVE',
    detail: fifth.join(',') || (receipt ? '' : 'no receipt yet'),
  });
  const waterline = rows.filter(r => r.kind === 'waterline');
  items.push({
    id: 'waterline',
    text: `${waterline.length} waterline acts recorded (do not count)`,
    state: 'PASS',
  });
  return items;
}
if (isMain(import.meta.url)) {
  if (a.includes('--control')) {
    const bad = evaluate({
      commits: [{ sha: 'deadbeefdeadbeef', fleet: false }],
      rows: [],
      receipt: { state: 'GREEN', gate: [] },
    });
    const good = evaluate({
      commits: [{ sha: 'a', fleet: true }],
      rows: [{ kind: 'waterline' }],
      receipt: { state: 'PASS', gate: [] },
    });
    const unresolved = spawnSync(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        '--phase',
        'P99',
        '--base',
        'refs/heads/no-such-ref',
      ],
      { encoding: 'utf8' }
    ).status;
    const corruptOnly = evaluate({
      commits: [{ sha: 'a', fleet: true }],
      rows: [],
      receipt: { state: 'PASS', gate: [] },
      corrupt: 1,
    });
    const ok =
      corruptOnly[1].state === 'FAIL' &&
      bad[0].state === 'FAIL' &&
      bad[2].state === 'FAIL' &&
      good.every(i => i.state === 'PASS') &&
      unresolved === 2;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} attest-phase controls (human commit and fifth state fail; fleet-only passes; unresolvable base exits 2; an unreadable ledger row fails)`
    );
    process.exit(ok ? 0 : 1);
  }
  const phase = opt('--phase');
  if (!phase) {
    console.error('usage: --phase P<n> [--base origin/main] | --control');
    process.exit(2);
  }
  const base = opt('--base', 'origin/main');
  const head = opt('--head', 'HEAD');
  // Both refs must resolve: an unresolvable base gave zero commits and the "commits" item passed
  // (verifier audit). The receipt is read at --head, not from the working tree.
  for (const [name, ref] of [
    ['base', base],
    ['head', head],
  ])
    if (tryGit(['rev-parse', '--verify', '-q', `${ref}^{commit}`]) === null) {
      console.log(
        `INCONCLUSIVE attest-phase: ${name} ${ref} does not resolve to a commit`
      );
      process.exit(2);
    }
  const shas = git(['rev-list', `${base}..${head}`])
    .split('\n')
    .filter(Boolean);
  const commits = shas.map(sha => ({ sha, fleet: isFleetCommit(sha) }));
  const allRows = ledgerRows(undefined, head);
  const rows = allRows.filter(r => r.phase === phase);
  const corrupt = allRows.filter(r => r.kind === 'CORRUPT').length;
  let receipt = null;
  try {
    receipt = JSON.parse(
      git(['show', `${head}:release-receipts/${phase}.json`])
    );
  } catch {}
  process.exit(
    report(
      `attest-phase ${phase}`,
      evaluate({ commits, rows, receipt, corrupt })
    )
  );
}
