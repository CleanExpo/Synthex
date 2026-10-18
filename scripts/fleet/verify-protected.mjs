#!/usr/bin/env node
/**
 * scripts/fleet/verify-protected.mjs --base <ref> [--head <ref>] [--control]
 *
 * Exit 0 when no commit between base and head touches a protected path without an
 * exemption. Exemptions (policy.json protected_exemptions):
 *   - the phase's own release-receipts/P<n>.json, which verify-receipt.mjs must validate;
 *   - ledger, manifest and daily-halt rows written by the orchestrator;
 *   - bootstrap: branch feature/fleet-p-1-* while scripts/fleet/policy.json is absent at base.
 * --control plants a protected edit in a scratch commit and requires exit 1 (K5).
 */
import {
  commitTrailers,
  isFleetCommit,
  policy,
  isProtected,
  changedFiles,
  git,
  tryGit,
  run,
  globToRegExp,
  ROOT,
  isMain,
} from './lib.mjs';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The receipt verifier next to THIS file: in CI that is the trusted base copy under /tmp/trusted,
// never the PR checkout's own copy (a PR could replace it with process.exit(0); verifier audit).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRUSTED_VERIFY_RECEIPT = path.join(HERE, '../release/verify-receipt.mjs');

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};

export function check(base, head = 'HEAD', cwd = ROOT) {
  // The policy that decides what is protected comes from the trusted BASE ref, never from the
  // change under test (Kimi review on PR #997: the PR's policy.json could shrink protected_paths).
  // Only while the base has no policy (bootstrap) is the local one used.
  const baseRaw = tryGit(['show', `${base}:scripts/fleet/policy.json`], {
    cwd,
  });
  const policyAtBase = baseRaw !== null;
  const pol = policyAtBase ? JSON.parse(baseRaw) : policy();
  if (!pol.protected_paths.includes('scripts/fleet/policy.json'))
    pol.protected_paths.push('scripts/fleet/policy.json'); // the policy file is protected whatever it says
  const findings = [];
  const files = changedFiles(base, head, cwd);
  const branch =
    tryGit(['rev-parse', '--abbrev-ref', head === 'HEAD' ? 'HEAD' : head], {
      cwd,
    }) || '';
  const bootstrap = !policyAtBase && /^feature\/fleet-p-1-/.test(branch);
  // Ledger rows and halt files keep their exemption. Manifests do not, wholesale: a branch may only
  // add or update its OWN phase's release-written manifests, in fleet commits on a fleet branch;
  // policy-hash.json, selftest.json and other phases' reports need a declared protected change
  // (verifier audit: any branch could rewrite policy-hash.json).
  const ledgerGlobs = pol.protected_exemptions.fleet_ledger_rows
    .filter(g => !g.startsWith('release-receipts/manifests/'))
    .map(globToRegExp);
  const phaseOfBranch = /^feature\/fleet-p(-?\d+)-/.exec(branch);
  const ownManifest = phaseOfBranch
    ? new RegExp(
        `^release-receipts/manifests/P${phaseOfBranch[1]}-(gate|review|handoff|units)\\.(json|md)$`
      )
    : null;
  const rawAt = (ref, f) => {
    const r = run('git', ['show', `${ref}:${f}`], { cwd });
    return r.code === 0 ? r.stdout : null;
  };
  // A merge commit counts as touching f only when the merge itself authored f: its blob differs from
  // what git's own automatic merge of the two parents produces (git merge-tree). A merge that only
  // carries commits already in base..head is judged through those commits, which must each qualify.
  // Anything unexpected (octopus merge, merge-tree failure) counts as authored: fail closed.
  const mergeAuthored = (sha, parents, f) => {
    if (parents.length !== 2) return true;
    // Exit 1 means conflicts; the tree is still written, with conflict markers in the conflicted
    // files, so a resolved conflict in f differs from it and counts as authored.
    const mt = run('git', ['merge-tree', '--write-tree', ...parents], { cwd });
    const auto = mt.code <= 1 ? mt.stdout.split('\n')[0].trim() : '';
    if (!/^[0-9a-f]{40}$/.test(auto)) return true;
    const blob = ref =>
      tryGit(['rev-parse', '-q', '--verify', `${ref}:${f}`], { cwd }) || '';
    return blob(auto) !== blob(sha);
  };
  const touchingCommits = f =>
    (
      tryGit(['log', '--format=%H %P', `${base}..${head}`, '--', f], {
        cwd,
      }) || ''
    )
      .split('\n')
      .filter(Boolean)
      .map(l => l.split(' '))
      .filter(
        ([sha, ...parents]) =>
          parents.length < 2 || mergeAuthored(sha, parents, f)
      )
      .map(([sha]) => sha);
  for (const f of files) {
    if (!isProtected(f, pol)) continue;
    if (bootstrap) {
      findings.push({ file: f, state: 'PASS', why: 'bootstrap exemption' });
      continue;
    }
    // Ledger rows: an existing *.jsonl that only grows (base bytes are a prefix at head), written
    // by fleet commits on a fleet branch. Halt files: adding one is always safe; removing one is
    // not. Anything else under these paths needs a declared protected change (verifier audit second
    // pass: any author could delete human-intervention rows or a daily halt).
    if (ledgerGlobs.some(r => r.test(f))) {
      const atBase = rawAt(base, f);
      const atHead = rawAt(head, f);
      const growsOnly =
        /^release-receipts\/ledger\/[^/]+\.jsonl$/.test(f) &&
        atHead !== null &&
        (atBase === null ||
          ((atBase === '' || atBase.endsWith('\n')) &&
            atHead.startsWith(atBase)));
      const fleetOnly =
        new RegExp(pol.branch_pattern).test(branch) &&
        touchingCommits(f).every(sha => isFleetCommit(sha, pol, cwd));
      if (growsOnly && fleetOnly) {
        findings.push({
          file: f,
          state: 'PASS',
          why: 'ledger rows appended by fleet commits',
        });
        continue;
      }
      if (
        /^release-receipts\/halt\/STOP-/.test(f) &&
        atHead !== null &&
        atBase === null
      ) {
        findings.push({ file: f, state: 'PASS', why: 'halt file added' });
        continue;
      }
    }
    if (
      ownManifest?.test(f) &&
      new RegExp(pol.branch_pattern).test(branch) &&
      touchingCommits(f).every(sha => isFleetCommit(sha, pol, cwd))
    ) {
      findings.push({
        file: f,
        state: 'PASS',
        why: 'own-phase release manifest',
      });
      continue;
    }
    // FD-3 (DECISIONS.md A-12): with no human to apply a label, a protected change is accepted only
    // when every commit touching the file is an orchestrator commit that declares it with the
    // trailers Fleet-Role: orchestrator and Protected-Change: <reason>; the independent review bound
    // to the head, the CI jobs and merge-phase.mjs are the checks that replace the label.
    // The declaring commits must also be fleet commits (fleet committer + a real role). Trailers
    // and committer are still author-supplied; a signed trust root is DECISIONS.md OPEN-4.
    const touching = touchingCommits(f);
    const declared =
      touching.length > 0 &&
      touching.every(sha => {
        const t = commitTrailers(sha, cwd);
        return (
          isFleetCommit(sha, pol, cwd) &&
          t['Fleet-Role'] === 'orchestrator' &&
          Boolean(t['Protected-Change'])
        );
      });
    if (declared && new RegExp(pol.branch_pattern).test(branch)) {
      findings.push({
        file: f,
        state: 'PASS',
        why: `orchestrator protected-change declared in ${touching.length} commit(s), checked by review + CI + merge-phase`,
      });
      continue;
    }
    const m = /^release-receipts\/(P-?\d+)\.json$/.exec(f);
    if (m) {
      const r = run(
        process.execPath,
        [
          TRUSTED_VERIFY_RECEIPT,
          '--repo',
          cwd,
          '--head',
          head,
          '--phase',
          m[1],
        ],
        { cwd }
      );
      findings.push({
        file: f,
        state: r.code === 0 ? 'PASS' : 'FAIL',
        why:
          r.code === 0
            ? 'own-phase receipt validated'
            : `receipt invalid: ${(r.stdout + r.stderr).trim().slice(0, 200)}`,
      });
      continue;
    }
    findings.push({
      file: f,
      state: 'FAIL',
      why: 'protected path changed without exemption',
    });
  }
  return { base, head, branch, bootstrap, files: files.length, findings };
}

function control() {
  // Scratch repo scenarios, each run through this script (cwd = the scratch repo, so ROOT, policy
  // and git all resolve there). Every one must exit as expected.
  const dir = mkdtempSync(path.join(tmpdir(), 'vp-control-'));
  const fleet = [
    '-c',
    'user.name=Synthex Fleet',
    '-c',
    'user.email=fleet@synthex.local',
  ];
  const human = [
    '-c',
    'user.name=someone',
    '-c',
    'user.email=someone@example.invalid',
  ];
  const g = (a, who = human) =>
    execFileSync('git', [...who, '-c', 'core.hooksPath=/dev/null', ...a], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
  const put = (f, body) => {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    writeFileSync(path.join(dir, f), body);
  };
  // A 20-line file with optional replacements, so edits at lines 1 and 20 land in separate hunks.
  const lines = (over = {}) =>
    Array.from({ length: 20 }, (_, k) => over[k + 1] || `L${k + 1}`).join(
      '\n'
    ) + '\n';
  const commit = (msg, who) => {
    g(['add', '-A'], who);
    g(['commit', '-q', '--allow-empty', '-m', msg], who);
  };
  const branch = (name, steps) => {
    g(['checkout', '-q', '-B', name, base]);
    steps();
    const r = run(
      process.execPath,
      [fileURLToPath(import.meta.url), '--base', base, '--head', 'HEAD'],
      { cwd: dir }
    );
    return r.code;
  };
  let base;
  try {
    g(['init', '-q', '-b', 'main']);
    put(
      'scripts/fleet/policy.json',
      readFileSync(path.join(ROOT, 'scripts/fleet/policy.json'))
    );
    put('scripts/fleet/guard.mjs', '// guard\n');
    put('tests/eval/jev/floors.json', '{"families":{}}\n');
    put('release-receipts/manifests/policy-hash.json', '{"sha256":"base"}\n');
    put(
      'release-receipts/ledger/fleet.jsonl',
      '{"kind":"human-intervention","phase":"P0"}\n'
    );
    put('release-receipts/halt/STOP-2026-10-18', 'halt\n');
    commit('control base', fleet);
    base = g(['rev-parse', 'HEAD']);
    const declared = 'x\n\nFleet-Role: orchestrator\nProtected-Change: control';
    const got = {
      plantedFloors: branch('feature/fleet-p0-control', () => {
        put('tests/eval/jev/floors.json', '{"planted":true}\n');
        commit('planted protected edit');
      }),
      renameOut: branch('feature/x-rename', () => {
        g(['mv', 'scripts/fleet/guard.mjs', 'tools-guard.mjs']);
        commit('rename a protected file out');
      }),
      nonAsciiWorkflow: branch('feature/x-utf8', () => {
        put('.github/workflows/é.yml', 'on: push\n');
        commit('non-ASCII workflow');
      }),
      manifestRewrite: branch('feature/x-manifest', () => {
        put(
          'release-receipts/manifests/policy-hash.json',
          '{"sha256":"attacker"}\n'
        );
        commit('rewrite policy-hash');
      }),
      declaredByHuman: branch('feature/fleet-p1-human', () => {
        put('.github/workflows/evil.yml', 'on: push\n');
        commit(declared, human);
      }),
      replacedVerifier: branch('feature/fleet-p1-verifier', () => {
        put('scripts/release/verify-receipt.mjs', 'process.exit(0)\n');
        commit(declared, fleet);
        put('release-receipts/P1.json', '{"phase":"P1","state":"PASS"}\n');
        commit('bogus receipt', fleet);
      }),
      ledgerRowDeleted: branch('feature/x-ledger', () => {
        put('release-receipts/ledger/fleet.jsonl', '');
        commit('drop the human-intervention row');
      }),
      ledgerAppended: branch('feature/fleet-p1-ledger', () => {
        put(
          'release-receipts/ledger/fleet.jsonl',
          '{"kind":"human-intervention","phase":"P0"}\n{"kind":"review","phase":"P1"}\n'
        );
        commit('append a ledger row\n\nFleet-Role: orchestrator', fleet);
      }),
      haltRemoved: branch('feature/x-halt', () => {
        g(['rm', '-q', 'release-receipts/halt/STOP-2026-10-18']);
        commit('remove the daily halt');
      }),
      // Both sides edit the same protected file in declared commits, far apart, so the merge
      // auto-combines them and is not TREESAME to either parent (git log lists it) though it
      // authored nothing (diff-tree --cc is empty).
      mergeCarriesDeclared: branch('feature/fleet-p1-merge', () => {
        put('scripts/fleet/guard.mjs', lines());
        commit(declared, fleet);
        g(['checkout', '-q', '-B', 'side-declared']);
        put('scripts/fleet/guard.mjs', lines({ 1: 'S1' }));
        commit(declared, fleet);
        g(['checkout', '-q', 'feature/fleet-p1-merge']);
        put('scripts/fleet/guard.mjs', lines({ 20: 'F20' }));
        commit(declared, fleet);
        g(
          [
            'merge',
            '-q',
            '--no-ff',
            'side-declared',
            '-m',
            'merge\n\nFleet-Role: orchestrator',
          ],
          fleet
        );
      }),
      evilMergeEdit: branch('feature/fleet-p1-evil', () => {
        put('scripts/fleet/guard.mjs', lines());
        commit(declared, fleet);
        g(['checkout', '-q', '-B', 'side-evil']);
        put('scripts/fleet/guard.mjs', lines({ 1: 'S1' }));
        commit(declared, fleet);
        g(['checkout', '-q', 'feature/fleet-p1-evil']);
        put('scripts/fleet/guard.mjs', lines({ 20: 'F20' }));
        commit(declared, fleet);
        g(['merge', '-q', '--no-ff', '--no-commit', 'side-evil'], fleet);
        put(
          'scripts/fleet/guard.mjs',
          lines({ 1: 'S1', 10: 'EVIL', 20: 'F20' })
        );
        g(['add', '-A'], fleet);
        g(['commit', '-q', '-m', 'merge\n\nFleet-Role: orchestrator'], fleet);
      }),
      conflictResolvedInMerge: branch('feature/fleet-p1-conflict', () => {
        put('scripts/fleet/guard.mjs', lines());
        commit(declared, fleet);
        g(['checkout', '-q', '-B', 'side-conflict']);
        put('scripts/fleet/guard.mjs', lines({ 10: 'SIDE' }));
        commit(declared, fleet);
        g(['checkout', '-q', 'feature/fleet-p1-conflict']);
        put('scripts/fleet/guard.mjs', lines({ 10: 'OURS' }));
        commit(declared, fleet);
        try {
          g(['merge', '-q', '--no-ff', '--no-commit', 'side-conflict'], fleet);
        } catch {
          // conflict expected; resolved below inside the merge commit
        }
        put('scripts/fleet/guard.mjs', lines({ 10: 'RESOLVED' }));
        g(['add', '-A'], fleet);
        g(['commit', '-q', '-m', 'merge\n\nFleet-Role: orchestrator'], fleet);
      }),
      ownManifest: branch('feature/fleet-p1-own', () => {
        put('release-receipts/manifests/P1-gate.json', '{"head":"x"}\n');
        commit('own-phase gate manifest\n\nFleet-Role: orchestrator', fleet);
      }),
    };
    const want = {
      plantedFloors: 1,
      renameOut: 1,
      nonAsciiWorkflow: 1,
      manifestRewrite: 1,
      declaredByHuman: 1,
      replacedVerifier: 1,
      ledgerRowDeleted: 1,
      ledgerAppended: 0,
      haltRemoved: 1,
      ownManifest: 0,
      mergeCarriesDeclared: 0,
      evilMergeEdit: 1,
      conflictResolvedInMerge: 1,
    };
    const bad = Object.keys(want).filter(k => got[k] !== want[k]);
    for (const k of bad)
      console.log(`FAIL control ${k}: exit ${got[k]}, want ${want[k]}`);
    return bad.length === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const ok = control();
    console.log(
      `${ok ? 'PASS' : 'FAIL'} verify-protected controls (planted floors edit, rename out, non-ASCII workflow, manifest rewrite, human-declared change, replaced verifier, ledger row deleted, halt removed, undeclared edit or conflict resolution inside a merge all exit 1; own-phase manifest, fleet-appended ledger rows and a merge carrying a declared change exit 0)`
    );
    process.exit(ok ? 0 : 1);
  }
  const base = opt('--base');
  if (!base) {
    console.error('usage: --base <ref> [--head <ref>] | --control');
    process.exit(2);
  }
  let res;
  try {
    res = check(base, opt('--head', 'HEAD'), path.resolve(opt('--repo', ROOT)));
  } catch (e) {
    console.log(`INCONCLUSIVE verify-protected: ${e.message}`);
    process.exit(2);
  }
  for (const f of res.findings)
    console.log(`${f.state.padEnd(6)} ${f.file} — ${f.why}`);
  const fails = res.findings.filter(f => f.state === 'FAIL').length;
  console.log(
    `verify-protected: ${res.files} changed files, ${res.findings.length} protected, ${fails} violations${res.bootstrap ? ' (bootstrap exemption active)' : ''}`
  );
  process.exit(fails ? 1 : 0);
}
