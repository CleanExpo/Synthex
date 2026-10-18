#!/usr/bin/env node
/**
 * scripts/fleet/pre-release.mjs [--base origin/main] [--head HEAD] [--phase P<n>] | --control
 *
 * The release preflight the founder asked for on 18/10/2026 ("so we are not wasting 3 hours again
 * doing the same thing"). Run before any review or push. Each rule maps to a failure that cost a
 * cycle that day:
 *   protected   a product branch (not feature/fleet-p<n>-*) must not change a protected path:
 *               the PR sits red on Protected Paths (#1016).
 *   squashed    a product branch is one commit on its base: the public-claims seed generator walks
 *               history, so an intermediate rename reads as removed public copy (#1016, P4 core).
 *   gated       a fleet branch has its phase gate manifest bound to HEAD with every command PASS,
 *               so the review is never the first full run (Codex on P2 7ed6271b: tripwire seeds).
 *   trailers    every fleet-branch commit is a fleet commit (fleet committer + Fleet-Role), or
 *               attest-phase rejects the release (8 P2 commits on 18/10/2026).
 *   one-sweep   the review brief asks for every blocking finding in one report.
 *   on-mini     gates and full suites run on the Mac mini external drive, not the cloud sandbox
 *               (disk filled on 18/10/2026); FLEET_ALLOW_CLOUD_GATE=1 overrides, and says so.
 *   visible-red open PRs with a failing check are listed so they are reported at once.
 */
import {
  policy,
  git,
  tryGit,
  run,
  isProtected,
  isFleetCommit,
  report,
  readJson,
  ROOT,
  isMain,
} from './lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const a = process.argv.slice(2);
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);

/** Pure decision over gathered facts, so the control can plant every case. */
export function evaluate(f, pol = policy()) {
  const fleet = new RegExp(pol.branch_pattern).test(f.branch);
  const items = [];
  const prot = f.changed.filter(p => isProtected(p, pol));
  items.push({
    id: 'protected',
    text: fleet
      ? `fleet branch: ${prot.length} protected path(s), declared changes are checked by verify-protected`
      : `product branch changes ${prot.length} protected path(s)`,
    state: fleet || prot.length === 0 ? 'PASS' : 'FAIL',
    detail: fleet ? '' : prot.slice(0, 5).join(', '),
  });
  items.push({
    id: 'squashed',
    text: fleet
      ? 'fleet branch: history kept (integrate merges)'
      : `product branch has ${f.commits.length} commit(s) on its base`,
    state: fleet || f.commits.length === 1 ? 'PASS' : 'FAIL',
  });
  const g = f.gate;
  const gateOk =
    !!g &&
    g.head === f.head &&
    Array.isArray(g.commands) &&
    g.commands.length > 0 &&
    g.commands.every(c => c.state === 'PASS');
  items.push({
    id: 'gated',
    text: fleet
      ? `gate manifest ${gateOk ? 'bound to HEAD, all PASS' : 'absent, stale or not all PASS'}`
      : 'product branch: run the pr-release-gate receipt checks on the exact head',
    state: fleet ? (gateOk ? 'PASS' : 'FAIL') : 'INCONCLUSIVE',
  });
  const nonFleet = f.commits.filter(c => !c.fleet);
  items.push({
    id: 'trailers',
    text: fleet
      ? `${nonFleet.length} of ${f.commits.length} commit(s) are not fleet commits`
      : 'product branch: not a fleet release',
    state: !fleet || nonFleet.length === 0 ? 'PASS' : 'FAIL',
    detail: nonFleet.map(c => c.sha.slice(0, 8)).join(', '),
  });
  items.push({
    id: 'one-sweep',
    text: 'review brief asks for every blocking finding in one report',
    state: /every blocking finding in one report/i.test(f.runPhaseText)
      ? 'PASS'
      : 'FAIL',
  });
  const mini = [pol.mac?.repo, pol.mac?.worktrees].filter(Boolean);
  const onMini = mini.some(r => f.root.startsWith(r));
  items.push({
    id: 'on-mini',
    text: onMini
      ? 'running on the Mac mini external drive'
      : f.allowCloud
        ? 'NOT on the Mac mini: FLEET_ALLOW_CLOUD_GATE=1 set, report it'
        : 'NOT on the Mac mini external drive: run the gate there',
    state: onMini || f.allowCloud ? 'PASS' : 'FAIL',
    detail: f.root,
  });
  items.push({
    id: 'visible-red',
    text:
      f.redPrs === null
        ? 'open PR checks unreadable'
        : `${f.redPrs.length} open PR(s) with a failing check`,
    state:
      f.redPrs === null
        ? 'INCONCLUSIVE'
        : f.redPrs.length === 0
          ? 'PASS'
          : 'FAIL',
    detail: (f.redPrs || []).map(p => `#${p.number} ${p.failed}`).join('; '),
  });
  return items;
}

function gather() {
  const pol = policy();
  const base = opt('--base', 'origin/main');
  const head = git(['rev-parse', opt('--head', 'HEAD')]);
  const branch =
    tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || opt('--branch', '');
  const m = /^feature\/fleet-p(-?\d+)-/.exec(branch);
  const phase = opt('--phase', m ? `P${m[1]}` : null);
  const changed = (
    tryGit(['diff', '--name-only', '--no-renames', '-z', base, head]) || ''
  )
    .split('\0')
    .filter(Boolean);
  const commits = (tryGit(['rev-list', `${base}..${head}`]) || '')
    .split('\n')
    .filter(Boolean)
    .map(sha => ({ sha, fleet: isFleetCommit(sha, pol) }));
  const gate = phase
    ? readJson(`release-receipts/manifests/${phase}-gate.json`, null)
    : null;
  const rp = path.join(ROOT, 'scripts/fleet/run-phase.mjs');
  const pr = run('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number,statusCheckRollup',
  ]);
  let redPrs = null;
  try {
    redPrs = JSON.parse(pr.stdout)
      .map(p => ({
        number: p.number,
        failed: (p.statusCheckRollup || [])
          .filter(c =>
            [
              'FAILURE',
              'ERROR',
              'TIMED_OUT',
              'CANCELLED',
              'ACTION_REQUIRED',
            ].includes(String(c.conclusion || c.state || '').toUpperCase())
          )
          .map(c => c.name || c.context)
          .join('|'),
      }))
      .filter(p => p.failed);
  } catch {}
  return {
    branch,
    head,
    changed,
    commits,
    gate: gate ? { head: gate.head, commands: gate.commands || [] } : null,
    runPhaseText: existsSync(rp) ? readFileSync(rp, 'utf8') : '',
    root: ROOT,
    allowCloud: process.env.FLEET_ALLOW_CLOUD_GATE === '1',
    redPrs,
  };
}

function control() {
  const pol = policy();
  const mini = pol.mac.worktrees + '/x';
  const base = {
    branch: 'feature/fleet-p3-contract',
    head: 'h',
    changed: ['lib/a.ts', 'scripts/fleet/lib.mjs'],
    commits: [{ sha: 'aaaaaaaa', fleet: true }],
    gate: { head: 'h', commands: [{ state: 'PASS' }] },
    runPhaseText: 'report EVERY blocking finding in one report',
    root: mini,
    allowCloud: false,
    redPrs: [],
  };
  const state = (f, id) =>
    evaluate({ ...base, ...f }, pol).find(i => i.id === id).state;
  const cases = [
    [
      'clean fleet release passes',
      () => evaluate(base, pol).every(i => i.state === 'PASS'),
    ],
    [
      'product branch with a protected path fails',
      () => state({ branch: 'feature/learning-loop' }, 'protected') === 'FAIL',
    ],
    [
      'product branch with two commits fails',
      () =>
        state(
          {
            branch: 'feature/x',
            changed: ['lib/a.ts'],
            commits: [
              { sha: 'a', fleet: false },
              { sha: 'b', fleet: false },
            ],
          },
          'squashed'
        ) === 'FAIL',
    ],
    [
      'stale gate manifest fails',
      () =>
        state(
          { gate: { head: 'old', commands: [{ state: 'PASS' }] } },
          'gated'
        ) === 'FAIL',
    ],
    [
      'gate with a failed command fails',
      () =>
        state(
          { gate: { head: 'h', commands: [{ state: 'FAIL' }] } },
          'gated'
        ) === 'FAIL',
    ],
    [
      'fleet commit without a role fails',
      () =>
        state({ commits: [{ sha: 'bbbbbbbb', fleet: false }] }, 'trailers') ===
        'FAIL',
    ],
    [
      'brief without the all-findings line fails',
      () => state({ runPhaseText: 'review it' }, 'one-sweep') === 'FAIL',
    ],
    [
      'cloud sandbox gate fails',
      () => state({ root: '/tmp/wt-main' }, 'on-mini') === 'FAIL',
    ],
    [
      'cloud sandbox with the explicit override passes',
      () =>
        state({ root: '/tmp/wt-main', allowCloud: true }, 'on-mini') === 'PASS',
    ],
    [
      'open red PR fails',
      () =>
        state(
          { redPrs: [{ number: 1016, failed: 'Protected Paths' }] },
          'visible-red'
        ) === 'FAIL',
    ],
    [
      'unreadable PR list is inconclusive, not pass',
      () => state({ redPrs: null }, 'visible-red') === 'INCONCLUSIVE',
    ],
  ];
  const bad = cases.filter(([, fn]) => !fn());
  for (const [n] of bad) console.log(`FAIL control: ${n}`);
  console.log(
    `${bad.length ? 'FAIL' : 'PASS'} pre-release controls (${cases.length - bad.length}/${cases.length})`
  );
  return bad.length === 0;
}

if (isMain(import.meta.url)) {
  if (a.includes('--control')) process.exit(control() ? 0 : 1);
  process.exit(report('pre-release', evaluate(gather())));
}
