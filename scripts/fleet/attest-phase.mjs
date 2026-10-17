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
  isFleetCommit,
  STATES,
  readJson,
  report,
} from './lib.mjs';
const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : d;
};
export function evaluate({ commits, rows, receipt }) {
  const items = [];
  const human = commits.filter(c => !c.fleet);
  items.push({
    id: 'commits',
    text: `${commits.length} commits on the phase branch, ${human.length} human-authored`,
    state: human.length ? 'FAIL' : 'PASS',
    detail: human.map(c => c.sha.slice(0, 12)).join(','),
  });
  const interventions = rows.filter(r => r.kind === 'human-intervention');
  items.push({
    id: 'interventions',
    text: `${interventions.length} human interventions in the ledger`,
    state: interventions.length ? 'FAIL' : 'PASS',
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
    const ok =
      bad[0].state === 'FAIL' &&
      bad[2].state === 'FAIL' &&
      good.every(i => i.state === 'PASS');
    console.log(
      `${ok ? 'PASS' : 'FAIL'} attest-phase controls (human commit and fifth state fail; fleet-only passes)`
    );
    process.exit(ok ? 0 : 1);
  }
  const phase = opt('--phase');
  if (!phase) {
    console.error('usage: --phase P<n> [--base origin/main] | --control');
    process.exit(2);
  }
  const base = opt('--base', 'origin/main');
  const shas = (tryGit(['rev-list', `${base}..HEAD`]) || '')
    .split('\n')
    .filter(Boolean);
  const commits = shas.map(sha => ({ sha, fleet: isFleetCommit(sha) }));
  const rows = ledgerRows().filter(r => r.phase === phase);
  const receipt = readJson(`release-receipts/${phase}.json`, null);
  process.exit(
    report(`attest-phase ${phase}`, evaluate({ commits, rows, receipt }))
  );
}
