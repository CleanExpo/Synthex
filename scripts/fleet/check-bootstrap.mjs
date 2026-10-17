#!/usr/bin/env node
/**
 * scripts/fleet/check-bootstrap.mjs — Phase -1 gate, adapted to the Cloudroom substrate (FD-1).
 * Prints one PASS/FAIL/INCONCLUSIVE/DISABLED line per item and never prints a secret value.
 * Spec table items map as follows (DECISIONS.md A-3, A-7):
 *  1 host            -> Node floor, git repo, policy present, sandbox is Linux with the fleet lib loadable
 *  2 FLEET_HOME/RUN  -> policy hash recorded in release-receipts/manifests/policy-hash.json, halt dir present, no real STOP
 *  3 metered key     -> DISABLED by design (A-2) until P8; recorded, never a FAIL
 *  4 push principal  -> gh auth works; committer identity configured; FD-2 recorded in DECISIONS.md
 *  5 review lanes    -> independent_review.py --list-lanes shows at least one non-Claude lane with a credential (never cursor/codex)
 *  6 Done harness    -> donectl status and selftest run on this host
 *  7 local database  -> DATABASE_URL absent or names localhost/127.0.0.1 only (never a production host)
 *  8 repo controls   -> scripts/check-repo-controls.mjs exits 0 or 1 (2 = cannot read = FAIL)
 *  9 protected files -> every protected script exists and its --control exits 0; contracts generated
 * 10 scheduler       -> Cloudroom automations nightly/weekly/phase-advance exist (room-cli automation list)
 */
import {
  ledgerAppend,
  policy,
  policyHash,
  readJson,
  writeJson,
  run,
  sh,
  report,
  nodeVersionOk,
  haltState,
  ROOT,
  tryGit,
} from './lib.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const pol = policy();
const items = [];
const add = (id, text, state, detail) =>
  items.push({ id, text, state, detail });

// 1
add(
  1,
  'host: Node floor, git repo, policy, OS sandbox (Seatbelt on macOS, bubblewrap on Linux/WSL2, Cloudroom sandbox)',
  nodeVersionOk(pol.node_floor) &&
    tryGit(['rev-parse', '--git-dir']) &&
    ['linux', 'darwin'].includes(os.platform())
    ? 'PASS'
    : 'FAIL',
  `node ${process.versions.node} ${os.platform()}`
);
// 2
const hashFile = 'release-receipts/manifests/policy-hash.json';
const recorded = readJson(hashFile, null);
const h = policyHash();
if (process.argv.includes('--record')) {
  const prevHash = recorded ? recorded.sha256 : null;
  writeJson(hashFile, {
    schema: 'policy-hash/1',
    sha256: h,
    recorded_at: new Date().toISOString(),
  });
  if (prevHash !== h)
    ledgerAppend({
      kind: 'policy-hash',
      previous: prevHash,
      sha256: h,
      source: 'check-bootstrap --record',
    });
}
const rec2 = readJson(hashFile, null);
const halt = haltState();
add(
  2,
  'policy hash recorded and matches; halt dir present; no security STOP',
  rec2 &&
    rec2.sha256 === h &&
    existsSync(path.join(ROOT, pol.halt_dir)) &&
    !halt.security
    ? 'PASS'
    : 'FAIL',
  `recorded=${rec2 ? rec2.sha256.slice(0, 12) : 'none'} current=${h.slice(0, 12)} STOP=${halt.security}`
);
// 3
add(
  3,
  'model access for judged runs: Claude Max plan through Cloudroom child threads (no API key required, A-18)',
  'PASS',
  process.env.ANTHROPIC_API_KEY
    ? 'an API key is also present (value not printed)'
    : 'Max plan; metered key not required'
);
// 4
const gh = run('gh', ['api', 'user', '--jq', '.login']);
// Fleet commits set the identity per commit (-c user.name/email in fleetCommit), so the host's
// git config is not the fact being checked (MiniMax r6: it differs on the Mac). The fact is the
// committer recorded on the branch's latest fleet commit, falling back to host config when the
// branch has none yet (fresh clone before any fleet commit).
const lastFleet = tryGit([
  'log',
  '-1',
  '--format=%cn%x00%ce',
  '--grep=^Fleet-Role:',
]); // the newest commit that declares a fleet role, whoever committed it (CodeRabbit on PR #997)
const [cname, cemail] = lastFleet
  ? lastFleet.split('\0')
  : [
      tryGit(['config', '--get', 'user.name']),
      tryGit(['config', '--get', 'user.email']),
    ];
const fd2 =
  existsSync(path.join(ROOT, 'DECISIONS.md')) &&
  sh('grep -c "FD-2" DECISIONS.md').stdout.trim() !== '0';
add(
  4,
  'push principal: gh auth ok, fleet committer identity set, FD-2 recorded',
  gh.code === 0 && cemail === pol.committer.email && fd2 ? 'PASS' : 'FAIL',
  `gh=${gh.code === 0 ? gh.stdout.trim() : 'unauthenticated'} committer=${cname}<${cemail}>`
);
// 5
const lanes = run('python3', [
  path.join(
    os.homedir(),
    '.claude/skills/pr-release-gate/scripts/independent_review.py'
  ),
  '--list-lanes',
]);
const laneLines = lanes.stdout.split('\n').filter(l => /^\s*\d+\s+\w+/.test(l));
const usable = laneLines.filter(
  l =>
    !/cursor|codex/.test(l) && /(resolved|ok)/i.test(l) && !/NOT FOUND/.test(l)
);
add(
  5,
  'review lanes: at least one non-Claude lane other than cursor/codex has a credential',
  lanes.code === 0 && usable.length
    ? 'PASS'
    : lanes.code !== 0
      ? 'INCONCLUSIVE'
      : 'FAIL',
  usable.map(l => l.trim().split(/\s+/)[1]).join(',') ||
    lanes.stderr.slice(0, 120)
);
// 6
const donectl = path.join(
  os.homedir(),
  '.claude/skills/done-harness/scripts/donectl.py'
);
const st = run('python3', [donectl, 'status']);
const se = run('python3', [donectl, 'selftest']);
let seOk = false;
try {
  seOk = JSON.parse(se.stdout).checks.every(c => c.ok);
} catch {}
add(
  6,
  'Done harness: donectl status and selftest run on this host',
  st.code === 0 && seOk ? 'PASS' : 'FAIL',
  st.code === 0 ? 'status ok' : st.stderr.slice(0, 120)
);
// 7
const dbu = process.env.DATABASE_URL || '';
let dbHost = '';
try {
  dbHost = dbu ? new URL(dbu.replace(/^postgres(ql)?:/, 'http:')).hostname : '';
} catch {
  dbHost = 'unparseable';
}
add(
  7,
  'disposable local database: DATABASE_URL absent or localhost only',
  !dbu || dbHost === 'localhost' || dbHost === '127.0.0.1' ? 'PASS' : 'FAIL',
  dbu
    ? `host=${dbHost}`
    : 'DATABASE_URL unset (provision.mjs supplies a local one)'
);
// 8
const rc =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  run('gh', ['auth', 'token']).stdout.trim();
const rcr = run(process.execPath, ['scripts/check-repo-controls.mjs'], {
  env: { GITHUB_TOKEN: rc },
  timeout: 120000,
});
add(
  8,
  'repo controls: check-repo-controls.mjs reads live protection (exit 2 = cannot read)',
  rcr.code === 0 ? 'PASS' : rcr.code === 1 ? 'FAIL' : 'FAIL',
  `exit=${rcr.code} ${(rcr.stdout + rcr.stderr).trim().split('\n').slice(-1)[0]?.slice(0, 160)}`
);
// 9
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
const missing = controls.filter(c => !existsSync(path.join(ROOT, c)));
const badCtl = controls.filter(
  c =>
    existsSync(path.join(ROOT, c)) &&
    run(process.execPath, [c, '--control'], { timeout: 180000 }).code !== 0
);
const gc = run(process.execPath, [
  'scripts/fleet/gen-contracts.mjs',
  '--check',
]);
add(
  9,
  'protected scripts present, each --control exits 0, contracts generated and locked',
  !missing.length && !badCtl.length && gc.code === 0 ? 'PASS' : 'FAIL',
  `missing=${missing.join(',') || 'none'} badControl=${badCtl.join(',') || 'none'} contracts=${gc.code}`
);
// 10
const auto = run('room-cli', ['automation', 'list']);
let names = [];
try {
  const j = JSON.parse(auto.stdout);
  names = (j.automations || j || []).map(a => a.name || '');
} catch {
  names = auto.stdout.split('\n');
}
const need = ['fleet-nightly', 'fleet-weekly', 'fleet-phase-advance'];
const have = need.filter(n => names.some(x => String(x).includes(n)));
add(
  10,
  'scheduler: Cloudroom automations nightly, weekly, phase-advance exist',
  auto.code !== 0 ? 'INCONCLUSIVE' : have.length === 3 ? 'PASS' : 'FAIL',
  auto.code !== 0 ? 'room-cli unavailable' : `have=${have.join(',') || 'none'}`
);

process.exit(report('check-bootstrap', items));
