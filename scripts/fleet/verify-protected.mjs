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

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};

export function check(base, head = 'HEAD', cwd = ROOT) {
  const pol = policy();
  const findings = [];
  const files = changedFiles(base, head, cwd);
  const branch =
    tryGit(['rev-parse', '--abbrev-ref', head === 'HEAD' ? 'HEAD' : head], {
      cwd,
    }) || '';
  const policyAtBase =
    tryGit(['cat-file', '-e', `${base}:scripts/fleet/policy.json`], { cwd }) !==
    null;
  const bootstrap = !policyAtBase && /^feature\/fleet-p-1-/.test(branch);
  const ledgerGlobs =
    pol.protected_exemptions.fleet_ledger_rows.map(globToRegExp);
  for (const f of files) {
    if (!isProtected(f, pol)) continue;
    if (bootstrap) {
      findings.push({ file: f, state: 'PASS', why: 'bootstrap exemption' });
      continue;
    }
    if (ledgerGlobs.some(r => r.test(f))) {
      findings.push({ file: f, state: 'PASS', why: 'ledger row' });
      continue;
    }
    // FD-3 (DECISIONS.md A-12): with no human to apply a label, a protected change is accepted only
    // when every commit touching the file is an orchestrator commit that declares it with the
    // trailers Fleet-Role: orchestrator and Protected-Change: <reason>; the independent review bound
    // to the head, the CI jobs and merge-phase.mjs are the checks that replace the label.
    const touching = (
      tryGit(['log', '--format=%H', `${base}..${head}`, '--', f], { cwd }) || ''
    )
      .split('\n')
      .filter(Boolean);
    const declared =
      touching.length > 0 &&
      touching.every(sha => {
        const t = commitTrailers(sha, cwd);
        return (
          t['Fleet-Role'] === 'orchestrator' && Boolean(t['Protected-Change'])
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
          path.join(ROOT, 'scripts/release/verify-receipt.mjs'),
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
  let dir;
  try {
    // Negative control: a scratch clone with a planted floors.json edit must exit 1.
    dir = mkdtempSync(path.join(tmpdir(), 'vp-control-'));
    execFileSync('git', [
      'clone',
      '-q',
      '--shared',
      '--no-checkout',
      ROOT,
      dir,
    ]);
    execFileSync('git', ['checkout', '-q', 'HEAD', '--', '.'], { cwd: dir });
    // Seed the scratch clone with the policy and a floors file so the base commit carries both.
    for (const f of [
      'scripts/fleet/policy.json',
      'scripts/fleet/lib.mjs',
      'tests/eval/jev/floors.json',
    ]) {
      mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      writeFileSync(path.join(dir, f), readFileSync(path.join(ROOT, f)));
    }
    execFileSync(
      'git',
      [
        '-c',
        'user.name=control',
        '-c',
        'user.email=control@example.invalid',
        'add',
        '-A',
      ],
      { cwd: dir }
    );
    execFileSync(
      'git',
      [
        '-c',
        'user.name=control',
        '-c',
        'user.email=control@example.invalid',
        '-c',
        'core.hooksPath=/dev/null',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'control base',
      ],
      { cwd: dir }
    );
    const base = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    execFileSync('git', ['checkout', '-q', '-b', 'feature/fleet-p0-control'], {
      cwd: dir,
    });
    writeFileSync(
      path.join(dir, 'tests/eval/jev/floors.json'),
      '{"planted":true}\n'
    );
    execFileSync(
      'git',
      [
        '-c',
        'user.name=control',
        '-c',
        'user.email=control@example.invalid',
        '-c',
        'core.hooksPath=/dev/null',
        'commit',
        '-qam',
        'planted protected edit',
      ],
      { cwd: dir }
    );
    const r = run(
      process.execPath,
      [
        path.join(ROOT, 'scripts/fleet/verify-protected.mjs'),
        '--base',
        base,
        '--head',
        'HEAD',
      ],
      { cwd: dir }
    );
    return r.code === 1;
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const ok = control();
    console.log(
      `${ok ? 'PASS' : 'FAIL'} verify-protected negative control (planted floors.json edit exits 1)`
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
