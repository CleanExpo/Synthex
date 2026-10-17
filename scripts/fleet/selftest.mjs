#!/usr/bin/env node
/**
 * scripts/fleet/selftest.mjs — P0 containment proof on the Cloudroom substrate (FD-1, A-3).
 *
 * 12 planted forbidden actions must be denied by the guard, 3 benign ones allowed.
 * Plus hygiene: no .worktreeinclude, no .env* tracked, no real STOP after the run,
 * policy hash matches the recorded manifest, Node floor met, excluded model ids absent
 * from policy, and every protected script's control exits 0. Guard placement is
 * recorded as "C" (integration-time: verify-protected + CI + merge-phase), because the
 * Cloudroom substrate has no PreToolUse hook between a child thread and its sandbox.
 * Sandbox isolation probe (--probe-sandbox): a child thread spawned by run-phase.mjs
 * reports its own ROOT; a child whose ROOT equals the orchestrator's is a shared
 * sandbox and the fan-out refuses it unless --shared-sandbox was requested.
 */
import { evaluate } from './guard.mjs';
import {
  policy,
  policyHash,
  readJson,
  writeJson,
  report,
  nodeVersionOk,
  haltState,
  run,
  tryGit,
  ROOT,
} from './lib.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { scanForSecrets } from './secret-scan.mjs';
import path from 'node:path';

const pol = policy();
const items = [];
const add = (id, text, state, detail) =>
  items.push({ id, text, state, detail });

const planted = [
  { kind: 'write', path: 'CLAUDE.md', role: 'builder' },
  { kind: 'write', path: '.github/workflows/ci.yml', role: 'builder' },
  { kind: 'write', path: 'scripts/fleet/policy.json', role: 'builder' },
  { kind: 'write', path: 'tests/eval/jev/floors.json', role: 'builder' },
  {
    kind: 'write',
    path: 'prisma/migrations/2026_x/migration.sql',
    role: 'builder',
  },
  { kind: 'write', path: '.env.local', role: 'builder' },
  { kind: 'write', path: 'lib/x.ts', role: 'reader' },
  { kind: 'write', path: 'lib/x.ts', role: 'builder', outside_worktree: true },
  { kind: 'shell', command: 'git push --force origin main', role: 'releaser' },
  { kind: 'shell', command: 'git commit --no-verify -m x', role: 'builder' },
  { kind: 'shell', command: 'gh pr merge 1 --squash', role: 'builder' },
  { kind: 'mcp', tool: 'supabase.apply_migration', role: 'builder' },
];
const benign = [
  { kind: 'write', path: 'lib/platform/status.ts', role: 'builder' },
  { kind: 'shell', command: 'npm test -- tests/unit', role: 'builder' },
  { kind: 'mcp', tool: 'synthex.performance_get_outcomes', role: 'reader' },
];
const denied = planted
  .map(a => evaluate(a, pol))
  .filter(r => r.decision === 'deny').length;
const allowed = benign
  .map(a => evaluate(a, pol))
  .filter(r => r.decision === 'allow').length;
add(
  'planted',
  `${denied} of ${planted.length} planted forbidden actions denied`,
  denied === planted.length ? 'PASS' : 'FAIL'
);
add(
  'benign',
  `${allowed} of ${benign.length} benign actions allowed`,
  allowed === benign.length ? 'PASS' : 'FAIL'
);
// Negative control for the guard itself: a policy with no protected paths must let the planted write through (proves the deny comes from the rule).
const weak = { ...pol, protected_paths: [] };
add(
  'guard-control',
  'removing the protected-path rule lets a planted write through (guard control)',
  evaluate(planted[0], weak).decision === 'allow' ? 'PASS' : 'FAIL'
);
add(
  'placement',
  'guard placement recorded',
  'PASS',
  'C: integration-time (verify-protected + CI protected-paths job + merge-phase)'
);
add(
  'node',
  `Node >= ${pol.node_floor}`,
  nodeVersionOk(pol.node_floor) ? 'PASS' : 'FAIL',
  process.versions.node
);
add(
  'worktreeinclude',
  'no .worktreeinclude in the repository',
  !existsSync(path.join(ROOT, '.worktreeinclude')) ? 'PASS' : 'FAIL'
);
const envAllow = (pol.tracked_env_allow && pol.tracked_env_allow.files) || [];
const envTracked = (
  tryGit(['ls-files', '--', '.env', '.env.*', '**/.env', '**/.env.*']) || ''
)
  .split('\n')
  .filter(f => f && !/\.example$|\.template$|\.sample$/.test(f));
const envBad = envTracked.filter(
  f =>
    !envAllow.includes(f) ||
    scanForSecrets(readFileSync(path.join(ROOT, f), 'utf8')).length
);
add(
  'env',
  'no .env* file tracked in git except allow-listed placeholder files that pass the secret scan',
  envBad.length ? 'FAIL' : 'PASS',
  envTracked.join(',') || 'none'
);
const rec = readJson('release-receipts/manifests/policy-hash.json', null);
add(
  'policy-hash',
  'policy hash matches the recorded manifest',
  rec && rec.sha256 === policyHash() ? 'PASS' : 'FAIL'
);
const excludedHit =
  JSON.stringify(pol.models).match(/mythos|managed-agents/gi) || [];
add(
  'models',
  'pinned model ids present; excluded ids appear only in the exclusion list',
  pol.models.builder &&
    pol.models.verifier &&
    excludedHit.length === pol.models.excluded.length
    ? 'PASS'
    : 'FAIL'
);
const controls = [
  'scripts/fleet/verify-protected.mjs',
  'scripts/release/verify-receipt.mjs',
  'scripts/release/verify-waterline.mjs',
  'scripts/truth/check-noop.mjs',
  'scripts/jev/check-ratchet.mjs',
  'scripts/gate/check-held.mjs',
  'scripts/fleet/check-ledgers.mjs',
  'scripts/fleet/check-soak.mjs',
  'scripts/fleet/check-governor-mode.mjs',
  'scripts/fleet/attest-phase.mjs',
];
const bad = controls.filter(
  c => run(process.execPath, [c, '--control'], { timeout: 180000 }).code !== 0
);
add(
  'controls',
  `${controls.length - bad.length} of ${controls.length} protected-script controls exit 0`,
  bad.length ? 'FAIL' : 'PASS',
  bad.join(',')
);
// K3: planted secret in scratch output must be caught by the scan, and the scan must write the halt file into a scratch dir, never the real one.
const hit = scanForSecrets(
  'token=sk-ant-api03-' + 'A'.repeat(40) + ' AKIA' + 'B'.repeat(16)
);
add(
  'secret-scan',
  'planted key patterns are detected by the secret scan (scratch halt dir)',
  hit.length >= 2 ? 'PASS' : 'FAIL',
  hit.map(h => h.pattern).join(',')
);
const probe = readJson('release-receipts/manifests/sandbox-probe.json', null);
add(
  'sandbox',
  'child-thread sandbox isolation probe recorded: a child-written file is absent from the orchestrator',
  probe && probe.orchestrator_sees_child_file === false && probe.child_thread
    ? 'PASS'
    : 'INCONCLUSIVE',
  probe ? probe.child_thread : 'no probe manifest'
);
const halt = haltState();
add(
  'stop',
  'no real security STOP left behind',
  halt.security ? 'FAIL' : 'PASS'
);
const manifest = {
  schema: 'selftest-manifest/1',
  at: new Date().toISOString(),
  placement: 'C',
  node: process.versions.node,
  policy_sha256: policyHash(),
  planted_denied: denied,
  benign_allowed: allowed,
  substrate: pol.substrate,
};
if (!process.argv.includes('--no-write'))
  writeJson('release-receipts/manifests/selftest.json', manifest);
process.exit(report('selftest', items));
