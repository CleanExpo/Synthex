#!/usr/bin/env node
/**
 * scripts/fleet/run-phase.mjs --phase P<n> <step> [options]
 *
 * The phase orchestrator for the Cloudroom substrate (FD-1). Steps, each idempotent and each
 * writing ledger rows, so the orchestrating thread or the phase-advance automation can resume:
 *
 *   preflight   policy hash, halt files, Node floor, branch pattern, no open fleet PR for the phase
 *   prepare     fetch origin, create feature/fleet-p<n>-<slug> from origin/main, lock the Done contract
 *   spawn       --units <units.json>: one child thread per unit (fanout.mjs), wait, record results
 *   integrate   --unit <id> --branch <ref>: fetch a unit branch, guard its changed files, secret-scan
 *               the diff, merge into the phase branch (abort on conflict and queue the unit)
 *   gate        run the cumulative gate and the phase's definition of done in a fresh process each,
 *               write release-receipts/manifests/<phase>-gate.json with four-state results
 *   review      independent non-Claude review bound to HEAD via independent_review.py (never cursor/codex)
 *   release     write the receipt with verify-receipt --write, commit it, push the branch, wait for the
 *               GitHub push-run on the exact head, open the one PR, then merge-phase.mjs
 *   auto        preflight -> prepare -> spawn -> integrate (all) -> gate -> review -> release
 *
 * Stop rules (spec): a unit that fails twice is queued with evidence; a phase with a unit queued
 * twice stops and writes a blocker row into BACKLOG.md instead of widening scope.
 */
import {
  policy,
  policyHash,
  readJson,
  writeJson,
  run,
  sh,
  git,
  tryGit,
  ledgerAppend,
  haltState,
  nodeVersionOk,
  ROOT,
  changedFiles,
  STATES,
} from './lib.mjs';
import { evaluate as guard } from './guard.mjs';
import { scanForSecrets, haltOnHit } from './secret-scan.mjs';
import { spawnUnit, waitForUnits } from './fanout.mjs';
import {
  existsSync,
  rmSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : d;
};
const phase = opt('--phase');
const step =
  a.find(x => !x.startsWith('--') && !a[a.indexOf(x) - 1]?.startsWith('--')) ||
  'preflight';
const pol = policy();
const ph = pol.phases.find(p => p.id === phase);
if (!ph) {
  console.error(
    `unknown phase ${phase}; known: ${pol.phases.map(p => p.id).join(',')}`
  );
  process.exit(2);
}
const branch = `feature/fleet-${ph.id.toLowerCase()}-${ph.slug}`;
const NODE = process.execPath;
const NODE_DIR = path.dirname(NODE);
const sub = cmd =>
  cmd.replaceAll('$NODE_DIR', NODE_DIR).replaceAll('$NODE', NODE);
const fleetCommit = (msg, files) => {
  if (files)
    git(['add', '-A', '--', ...files]); // -A stages deletions too
  else git(['add', '-A']);
  return git([
    '-c',
    `user.name=${pol.committer.name}`,
    '-c',
    `user.email=${pol.committer.email}`,
    'commit',
    '-q',
    '-m',
    msg,
  ]);
};
const log = (s, m) =>
  console.log(`${s.padEnd(12)} run-phase ${phase} ${step}: ${m}`);

function preflight() {
  const rec = readJson('release-receipts/manifests/policy-hash.json', null);
  if (!rec || rec.sha256 !== policyHash()) {
    log('FAIL', 'policy hash does not match the recorded manifest');
    return 1;
  }
  const h = haltState();
  if (h.halted) {
    log(
      'FAIL',
      h.security
        ? 'security STOP present (a person clears it)'
        : 'daily ceiling halt'
    );
    return 1;
  }
  if (!nodeVersionOk(pol.node_floor)) {
    log('FAIL', `node ${process.versions.node} below floor`);
    return 1;
  }
  if (!new RegExp(pol.branch_pattern).test(branch)) {
    log('FAIL', `branch ${branch} violates pattern`);
    return 1;
  }
  const prev = pol.phases[pol.phases.indexOf(ph) - 1];
  if (prev) {
    git(['fetch', '-q', 'origin', 'main']);
    const prevReceipt = tryGit([
      'cat-file',
      '-e',
      `origin/main:release-receipts/${prev.id}.json`,
    ]);
    if (prevReceipt === null) {
      log('FAIL', `previous phase ${prev.id} has no receipt on origin/main`);
      return 1;
    }
  }
  const open = run('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--head',
    branch,
    '--json',
    'number',
  ]);
  let n = [];
  try {
    n = JSON.parse(open.stdout);
  } catch {}
  if (n.length) {
    log(
      'FAIL',
      `open PR #${n[0].number} already exists for ${branch}; one PR per phase`
    );
    return 1;
  }
  log('PASS', `ready: branch ${branch}, policy ${policyHash().slice(0, 12)}`);
  return 0;
}
function prepare() {
  git(['fetch', '-q', 'origin']);
  const exists = tryGit(['rev-parse', '--verify', `origin/${branch}`]);
  if (exists) git(['checkout', '-q', '-B', branch, `origin/${branch}`]);
  else git(['checkout', '-q', '-B', branch, 'origin/main']);
  const donectl = path.join(
    os.homedir(),
    '.claude/skills/done-harness/scripts/donectl.py'
  );
  const contract = readJson(`scripts/fleet/contracts/${phase}.json`);
  const st = run('python3', [donectl, 'status']);
  let locked = false;
  try {
    locked = /LOCKED/.test(JSON.parse(st.stdout).contract_status || '');
  } catch {}
  if (!locked) {
    const s = run('python3', [
      donectl,
      'start',
      `${phase} ${ph.slug}: ${ph.closes}`,
    ]);
    let cp = null;
    try {
      cp = JSON.parse(s.stdout).contract_path;
    } catch {}
    if (cp) {
      const c = JSON.parse(readFileSync(cp, 'utf8'));
      c.criteria = contract.criteria.map(x => ({
        id: x.id,
        statement: x.statement,
        recipe: sub(x.recipe),
        timeout: x.timeout,
      }));
      writeFileSync(cp, JSON.stringify(c, null, 2));
      const l = run('python3', [donectl, 'lock']);
      locked = l.code === 0;
      if (!locked)
        log(
          'INCONCLUSIVE',
          `donectl lock: ${(l.stdout + l.stderr).slice(0, 200)}`
        );
    } else
      log(
        'INCONCLUSIVE',
        `donectl start: ${(s.stdout + s.stderr).slice(0, 200)}`
      );
  }
  ledgerAppend({
    kind: 'start',
    phase,
    branch,
    step: 'prepare',
    contract_locked: locked,
    policy: policyHash(),
  });
  log(
    locked ? 'PASS' : 'INCONCLUSIVE',
    `on ${branch} from ${exists ? 'origin/' + branch : 'origin/main'}; Done contract ${locked ? 'LOCKED' : 'not locked'}`
  );
  return 0;
}
async function spawn() {
  const units = readJson(opt('--units'));
  if (units.length > pol.fanout.max_units_per_phase) {
    log('FAIL', 'too many units');
    return 1;
  }
  const conc = Number(opt('--concurrency', pol.fanout.concurrency));
  const all = {};
  for (let i = 0; i < units.length; i += conc) {
    const batch = units.slice(i, i + conc).map(u => ({
      ...spawnUnit({
        phase,
        unit: u,
        phaseBranch: branch,
        model: opt('--model'),
      }),
      phase,
    }));
    Object.assign(all, await waitForUnits(batch));
  }
  writeJson(`release-receipts/manifests/${phase}-units.json`, {
    phase,
    at: new Date().toISOString(),
    results: all,
  });
  const bad = Object.values(all).filter(r => r.state !== 'PASS').length;
  log(
    bad ? 'FAIL' : 'PASS',
    `${Object.keys(all).length} units, ${bad} not PASS`
  );
  return bad ? 1 : 0;
}
function integrate(unitArg, refArg) {
  const unit = unitArg || opt('--unit');
  const ref = refArg || opt('--branch');
  if (!unit || !ref) {
    log('FAIL', 'need --unit and --branch');
    return 2;
  }
  git(['fetch', '-q', 'origin', ref]);
  const files = changedFiles('HEAD', 'FETCH_HEAD');
  const denied = files
    .map(f => guard({ kind: 'write', path: f, role: 'builder' }, pol))
    .filter(r => r.decision === 'deny');
  if (denied.length) {
    ledgerAppend({
      kind: 'unit-rejected',
      phase,
      unit,
      reason: 'guard',
      files: denied.map(d => d.action.path),
    });
    log(
      'FAIL',
      `guard denied ${denied.map(d => d.action.path + ' (' + d.reason + ')').join('; ')}`
    );
    return 1;
  }
  const diff = git(['diff', 'HEAD', 'FETCH_HEAD']);
  const hits = scanForSecrets(diff);
  if (hits.length) {
    haltOnHit(hits, `unit ${unit} diff`);
    ledgerAppend({
      kind: 'halt',
      phase,
      unit,
      cause:
        'secret pattern in unit diff: ' + hits.map(h => h.pattern).join(','),
    });
    log('FAIL', 'secret pattern in diff; security STOP written');
    return 1;
  }
  const m = run('git', ['merge', '--no-ff', '--no-edit', '-q', 'FETCH_HEAD'], {
    cwd: ROOT,
  });
  if (m.code !== 0) {
    run('git', ['merge', '--abort']);
    ledgerAppend({
      kind: 'unit-queued',
      phase,
      unit,
      reason: 'merge conflict',
    });
    log('FAIL', `merge conflict; unit queued`);
    return 1;
  }
  ledgerAppend({
    kind: 'integrate',
    phase,
    unit,
    files: files.length,
    head: git(['rev-parse', 'HEAD']),
  });
  log('PASS', `${files.length} files from ${ref}`);
  return 0;
}
function retireStaleReceipt() {
  // A receipt and its review/gate manifests bind one reviewed commit. When fixes land after
  // them (review round-trips), the tracked files name a commit that is no longer HEAD's reviewed
  // state; leaving them is the receipt form of 2xx-with-empty-data (MiniMax r4 and r6 on PR
  // #997). Retire the tracked copies in a declared orchestrator commit before the gate runs;
  // the gate, review and release steps regenerate and commit fresh ones for the reviewed head.
  const head = git(['rev-parse', 'HEAD']);
  const candidates = [
    `release-receipts/${phase}.json`,
    `release-receipts/manifests/${phase}-review.json`,
    `release-receipts/manifests/${phase}-gate.json`,
  ];
  const stale = [];
  let reviewed = '';
  for (const file of candidates) {
    const raw = tryGit(['show', `HEAD:${file}`]);
    if (raw === null) continue; // not tracked at HEAD
    let bound = '';
    try {
      const o = JSON.parse(raw);
      bound = String(o.reviewed_commit || o.head_sha || o.head || '');
    } catch {
      bound = '';
    }
    const extra = bound
      ? git(['diff', '--name-only', `${bound}..HEAD`])
          .split('\n')
          .filter(f => f && !/^release-receipts\//.test(f))
      : ['(unparseable)'];
    if (!extra.length) continue;
    reviewed = reviewed || bound;
    stale.push({ file, bound, extra: extra.length });
  }
  if (!stale.length) return;
  for (const s of stale)
    if (existsSync(path.join(ROOT, s.file))) rmSync(path.join(ROOT, s.file)); // index entry stays; add -A stages the deletion
  fleetCommit(
    `chore(fleet): ${phase} retire stale receipt artefacts bound to ${reviewed.slice(0, 12)}\n\n${stale.map(s => `${s.file}: ${s.extra} non-receipt file(s) changed after ${s.bound.slice(0, 12)}`).join('\n')}\n\nThe gate, review and release steps rebind fresh artefacts to the next reviewed head.\n\nFleet-Role: orchestrator\nProtected-Change: retire stale ${phase} receipt artefacts (A-12)`,
    stale.map(s => s.file)
  );
  ledgerAppend({
    kind: 'receipt-retired',
    phase,
    head,
    reviewed,
    files: stale.map(s => s.file),
  });
  log(
    'PASS',
    `retired stale ${stale.map(s => s.file).join(', ')} (bound ${reviewed.slice(0, 12)}) in ${git(['rev-parse', '--short', 'HEAD'])}`
  );
}

function gate() {
  retireStaleReceipt();
  const contract = readJson(`scripts/fleet/contracts/${phase}.json`);
  const cmds = [
    ...contract.cumulative_gate.map(c => ({
      cmd: c,
      required: true,
      kind: 'cumulative',
    })),
    ...contract.criteria.map(c => ({
      cmd: c.recipe,
      required: true,
      kind: 'dod',
      id: c.id,
    })),
  ];
  const results = [];
  for (const c of cmds) {
    const r = sh(sub(c.cmd), {
      timeout: 3600000,
      // Gate commands run builder-written code; they get no GitHub token (CodeRabbit on PR #997).
      env: {
        FLEET_HALT_DIR: path.join(ROOT, pol.halt_dir),
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
      },
    });
    const state =
      r.code === 0
        ? 'PASS'
        : r.code === 2
          ? 'INCONCLUSIVE'
          : r.code === 3
            ? 'INCONCLUSIVE'
            : 'FAIL';
    results.push({
      cmd: c.cmd,
      kind: c.kind,
      id: c.id,
      required: c.required,
      state,
      exit: r.code,
      tail: (r.stdout + r.stderr)
        .trim()
        .split('\n')
        .slice(-3)
        .join(' | ')
        .slice(0, 400),
    });
    console.log(`${state.padEnd(12)} ${c.cmd} (exit ${r.code})`);
  }
  const head = git(['rev-parse', 'HEAD']);
  writeJson(`release-receipts/manifests/${phase}-gate.json`, {
    phase,
    head,
    tree: git(['rev-parse', 'HEAD^{tree}']),
    at: new Date().toISOString(),
    results,
  });
  const bad = results.filter(r => r.state !== 'PASS').length;
  ledgerAppend({
    kind: 'gate',
    phase,
    head,
    pass: results.length - bad,
    total: results.length,
  });
  log(
    bad ? 'FAIL' : 'PASS',
    `${results.length - bad} of ${results.length} gate commands PASS at ${head.slice(0, 12)}`
  );
  return bad ? 1 : 0;
}
function review() {
  const head = git(['rev-parse', 'HEAD']);
  const base = git(['merge-base', 'origin/main', 'HEAD']);
  const brief = path.join(os.tmpdir(), `brief-${phase}.md`);
  writeFileSync(
    brief,
    `# Independent review brief: Synthex ${phase} ${ph.slug}\n\nSpec: docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md, phase ${phase} (closes ${ph.closes}), AS AMENDED by docs/superpowers/specs/2026-10-17-vibe-to-leader-amendments.md (founder-ratified amendments AM-1..AM-5: Cloudroom substrate, fleet merges through merge-phase.mjs, P10 billing phase, policy in-repo, orchestrator protected-change trailer). Judge spec fidelity against the amended spec; a finding that restates an amended rule is answered by the amendments file and is not blocking. DECISIONS.md holds the founder's verbatim words.\nDefinition of done: ${ph.dod.join('; ')}.\nReview the diff ${base.slice(0, 12)}..${head.slice(0, 12)} for correctness, security (cross-tenant, secrets, injection), honest-status (no 2xx-with-empty-data), containment (protected paths, controls that can fail), and fidelity to the amended spec. Report schema 1 or 2 JSON with verdict PASS or FAIL and findings; cite file and line for each.\n`
  );
  const out = `release-receipts/manifests/${phase}-review.json`;
  const script = path.join(
    os.homedir(),
    '.claude/skills/pr-release-gate/scripts/independent_review.py'
  );
  let last = null;
  for (const lane of pol.review.lanes_in_order) {
    if (pol.review.never.includes(lane)) continue;
    let r;
    if (lane === 'minimax') {
      // The MiniMax key lives only on the founder's Mac (mm-ask). Ship the commits as a bundle so no
      // branch is pushed before the review names the head (spec: push only after the review report).
      const bundle = path.join(os.tmpdir(), `review-${phase}.bundle`);
      run('git', ['bundle', 'create', bundle, `${base}..HEAD`]);
      run('room-cli', ['mac', 'push', bundle, '/tmp'], { timeout: 600000 });
      run('room-cli', ['mac', 'push', brief, '/tmp'], { timeout: 120000 });
      const macCmd = `cd ~/Synthex && git fetch -q origin main && git fetch -q -f /tmp/${path.basename(bundle)} +${head}:refs/fleet/review-${phase} && rm -f /tmp/review-${phase}.json && python3 ~/.claude/skills/pr-release-gate/scripts/independent_review.py --brief /tmp/${path.basename(brief)} --base ${base} --head ${head} --repo ~/Synthex --out /tmp/review-${phase}.json --lane minimax; echo MAC_EXIT=$?; echo REPORT-BEGIN; cat /tmp/review-${phase}.json 2>/dev/null`;
      const m = run('room-cli', ['mac', 'run', macCmd], { timeout: 1800000 });
      const body = m.stdout.includes('REPORT-BEGIN')
        ? m.stdout.slice(m.stdout.indexOf('REPORT-BEGIN') + 12).trim()
        : '';
      // The report is the verdict (release law): accept it when it parses and names this head.
      let parsed = null;
      try {
        parsed = body.startsWith('{') ? JSON.parse(body) : null;
      } catch {
        parsed = null;
      }
      const bound =
        parsed &&
        String(parsed.head_sha || parsed.head || '').startsWith(
          head.slice(0, 12)
        );
      r = { code: bound ? 0 : 1, stdout: m.stdout, stderr: m.stderr };
      if (r.code === 0) {
        try {
          writeJson(out, parsed);
        } catch {
          r.code = 1;
        }
      }
    } else {
      const models =
        lane === 'openrouter' ? pol.review.openrouter_models || [null] : [null];
      for (const model of models) {
        r = run(
          'python3',
          [
            script,
            '--brief',
            brief,
            '--base',
            base,
            '--head',
            head,
            '--repo',
            ROOT,
            '--out',
            path.join(ROOT, out),
            '--lane',
            lane,
          ],
          {
            timeout: 1800000,
            env: model ? { PR_GATE_OPENROUTER_MODEL: model } : {},
          }
        );
        if (r.code === 0 && existsSync(path.join(ROOT, out))) break;
        if (model)
          console.log(
            `DISABLED     lane ${lane} model ${model}: ${(r.stdout + r.stderr).trim().split('\n').slice(-3, -2).join('').slice(0, 200)}`
          );
      }
    }
    last = r;
    if (r.code === 0 && existsSync(path.join(ROOT, out))) {
      const rep = readJson(out);
      rep.head = rep.head || head;
      rep.lane = rep.lane || lane;
      writeJson(out, rep);
      ledgerAppend({ kind: 'review', phase, head, lane, verdict: rep.verdict });
      log(
        /^(PASS|APPROVE)/i.test(String(rep.verdict)) ? 'PASS' : 'FAIL',
        `${lane}: ${rep.verdict} bound to ${head.slice(0, 12)}`
      );
      return /^(PASS|APPROVE)/i.test(String(rep.verdict)) ? 0 : 1;
    }
    console.log(
      `DISABLED     lane ${lane}: ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' | ').slice(0, 300)}`
    );
  }
  ledgerAppend({
    kind: 'review',
    phase,
    head,
    state: 'INCONCLUSIVE',
    detail: 'every lane unavailable',
  });
  log(
    'INCONCLUSIVE',
    'every review lane unavailable; work queued, never self-certified'
  );
  return 2;
}
function release() {
  const gateFile = `release-receipts/manifests/${phase}-gate.json`;
  const g = readJson(gateFile, null);
  const reviewed = git(['rev-parse', 'HEAD']);
  if (!g || g.head !== reviewed) {
    log('FAIL', 'gate manifest absent or not bound to HEAD; run gate first');
    return 1;
  }
  const rep = readJson(`release-receipts/manifests/${phase}-review.json`, null);
  if (
    !rep ||
    (!String(rep.head).startsWith(reviewed.slice(0, 12)) &&
      !reviewed.startsWith(String(rep.head)))
  ) {
    log('FAIL', 'review report absent or not bound to HEAD; run review first');
    return 1;
  }
  const w = run(NODE, [
    'scripts/release/verify-receipt.mjs',
    '--write',
    '--phase',
    phase,
    '--reviewed',
    reviewed,
    '--gate',
    gateFile,
    '--report',
    `release-receipts/manifests/${phase}-review.json`,
  ]);
  if (w.code !== 0) {
    log('FAIL', `receipt not PASS: ${w.stdout.trim()}`);
    return 1;
  }
  // The gate manifest must be committed with the receipt so verify-receipt can read it at head.
  const sha = fleetCommit(
    `chore(fleet): ${phase} release receipt\n\nReviewed-Commit: ${reviewed}\nFleet-Role: releaser\nRatified-By: FD-3`,
    [
      `release-receipts/${phase}.json`,
      gateFile,
      `release-receipts/manifests/${phase}-review.json`,
      pol.ledger,
    ].filter(f => existsSync(path.join(ROOT, f)))
  );
  const head = git(['rev-parse', 'HEAD']);
  const v = run(NODE, [
    'scripts/release/verify-receipt.mjs',
    '--head',
    head,
    '--phase',
    phase,
  ]);
  if (v.code !== 0) {
    log('FAIL', v.stdout.trim());
    return 1;
  }
  const p = run('git', ['push', '-u', 'origin', branch]);
  if (p.code !== 0) {
    log('FAIL', `push: ${p.stderr.trim().slice(0, 200)}`);
    return 1;
  }
  ledgerAppend({ kind: 'push', phase, head, branch });
  log(
    'PASS',
    `pushed ${branch} at ${head.slice(0, 12)}; waiting for the push-run`
  );
  const ok = waitForChecks(head, 45 * 60 * 1000);
  if (!ok) {
    log('FAIL', 'push-run not green on the exact head');
    return 1;
  }
  const body = `Phase ${phase} (${ph.slug}) — closes ${ph.closes}.\n\nReviewed commit: ${reviewed}\nReceipt: release-receipts/${phase}.json\nReview report: release-receipts/manifests/${phase}-review.json\nGate manifest: ${gateFile}\n\nSpec: docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md\nMerge path: scripts/fleet/merge-phase.mjs (DECISIONS.md FD-3)\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const pr = run('gh', [
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    branch,
    '--title',
    `feat(fleet): ${phase} ${ph.slug}`,
    '--body',
    body,
  ]);
  // One coherent PR per phase: gh refuses a second PR for the branch, so reuse the open one.
  const num =
    (pr.stdout.match(/\/pull\/(\d+)/) || [])[1] ||
    ((pr.stderr + pr.stdout).match(/\/pull\/(\d+)/) || [])[1];
  if (!num) {
    log('FAIL', `gh pr create: ${(pr.stderr || pr.stdout).slice(0, 200)}`);
    return 1;
  }
  ledgerAppend({ kind: 'pr', phase, head, pr: num });
  log('PASS', `opened PR #${num}`);
  // PR-triggered checks run on the same head; wait for them too, then merge through the gated path.
  waitForChecks(head, 45 * 60 * 1000);
  const m = run(
    NODE,
    [
      'scripts/fleet/merge-phase.mjs',
      ...(existsSync(
        path.join(ROOT, `release-receipts/manifests/${phase}-threads.json`)
      )
        ? ['--threads', `release-receipts/manifests/${phase}-threads.json`]
        : []),
      '--pr',
      num,
      '--head',
      head,
      '--phase',
      phase,
    ],
    { timeout: 300000 }
  );
  console.log(m.stdout.trim());
  return m.code;
}
function waitForChecks(head, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = run('gh', [
      'api',
      `repos/{owner}/{repo}/commits/${head}/check-runs?per_page=100`,
      '--jq',
      '[.check_runs[] | {name, status, conclusion}]',
    ]);
    let cr = [];
    try {
      cr = JSON.parse(r.stdout);
    } catch {}
    // Required contexts come from the pull_request run, which registers after the push-run
    // finishes; a head missing any of them is still pending (P-1: merge refused on PR #997).
    const required = ['Build', 'Lint', 'Protected paths', 'Receipt verify'];
    const pending = cr.filter(c => c.status !== 'completed');
    for (const name of required)
      if (!cr.some(c => c.name === name)) pending.push({ name });
    const failed = cr.filter(
      c =>
        c.status === 'completed' &&
        !['success', 'neutral', 'skipped'].includes(c.conclusion)
    );
    if (cr.length && !pending.length) {
      if (failed.length) {
        console.log(`FAIL checks: ${failed.map(c => c.name).join(', ')}`);
        return false;
      }
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  }
  return false;
}
const steps = { preflight, prepare, spawn, integrate, gate, review, release };
if (step === 'auto') {
  for (const s of [
    'preflight',
    'prepare',
    'spawn',
    'integrate-all',
    'gate',
    'review',
    'release',
  ]) {
    if (s === 'integrate-all') {
      // Builder work lives on fleet-unit/* branches; bring every PASS unit onto the phase branch
      // before the gate (CodeRabbit on PR #997: auto had no integrate step).
      const units = readJson(`release-receipts/manifests/${phase}-units.json`, {
        results: {},
      }).results;
      for (const [id, r] of Object.entries(units)) {
        if (r.state !== 'PASS') continue;
        const c = integrate(id, r.branch || `fleet-unit/${phase}/${id}`);
        if (c !== 0) process.exit(c);
      }
      continue;
    }
    const c = await steps[s]();
    if (c !== 0) process.exit(c);
  }
  process.exit(0);
}
if (!steps[step]) {
  console.error('steps: ' + Object.keys(steps).join(', ') + ', auto');
  process.exit(2);
}
process.exit(await steps[step]());
