#!/usr/bin/env node
/**
 * scripts/release/verify-receipt.mjs --head <sha> [--phase P<n>] | --write --phase P<n> ... | --control
 *
 * A receipt names the reviewed commit, the tested tree, the independent-review report
 * and the cost ledger slice. The check passes only if the diff from the reviewed commit
 * to the head holds nothing except the receipt file (rule B3), every state is one of the
 * four, and the review report names the reviewed commit.
 */
import {
  readJson,
  writeJson,
  git,
  tryGit,
  STATES,
  policy,
  sha256,
  ROOT,
  ledgerRows,
  run,
  isMain,
} from '../fleet/lib.mjs';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};

export function verify(head, phase, cwd = ROOT) {
  const problems = [];
  const sha = git(['rev-parse', head], { cwd });
  const p = phase || detectPhase(sha, cwd);
  if (!p)
    return {
      ok: false,
      problems: ['no receipt file in head commit and no --phase given'],
    };
  const file = `release-receipts/${p}.json`;
  const raw = tryGit(['show', `${sha}:${file}`], { cwd });
  if (raw === null)
    return { ok: false, problems: [`${file} absent at ${sha.slice(0, 12)}`] };
  let r;
  try {
    r = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ['receipt is not JSON'] };
  }
  for (const k of [
    'phase',
    'reviewed_commit',
    'tested_tree',
    'review_report',
    'cost_ledger',
    'gate',
    'state',
  ])
    if (!(k in r)) problems.push(`missing ${k}`);
  if (r.phase !== p) problems.push(`phase mismatch ${r.phase} != ${p}`);
  if (!STATES.includes(r.state)) problems.push(`fifth state ${r.state}`);
  for (const g of r.gate || [])
    if (!STATES.includes(g.state))
      problems.push(`gate ${g.cmd}: fifth state ${g.state}`);
  if ((r.gate || []).some(g => g.state !== 'PASS' && g.required !== false))
    problems.push('a required gate command is not PASS');
  // Evidence: every command the phase contract names must appear in the receipt's gate with PASS
  // (CodeRabbit on PR #997: "gate": [] used to validate).
  const contractRaw = tryGit(
    ['show', `${sha}:scripts/fleet/contracts/${p}.json`],
    { cwd }
  );
  if (contractRaw === null)
    problems.push(
      `phase contract scripts/fleet/contracts/${p}.json absent at head`
    );
  else {
    let contract = null;
    try {
      contract = JSON.parse(contractRaw);
    } catch {
      problems.push('phase contract not JSON');
    }
    if (contract) {
      const wanted = [
        ...(contract.cumulative_gate || []),
        ...(contract.criteria || []).map(c => c.recipe),
      ];
      if (!wanted.length) problems.push('phase contract names no gate command');
      for (const cmd of wanted)
        if (!(r.gate || []).some(g => g.cmd === cmd && g.state === 'PASS'))
          problems.push(`contract command not PASS in receipt gate: ${cmd}`);
    }
  }
  if (r.state !== 'PASS') problems.push(`receipt state ${r.state}`);
  // Binding: head differs from reviewed commit by the receipt file alone.
  // A pinned 40-hex commit, never a ref, a prefix or a revision expression (verifier audit).
  const reviewed = r.reviewed_commit;
  if (!/^[0-9a-f]{40}$/.test(String(reviewed || '')))
    problems.push('reviewed_commit is not a full 40-hex commit SHA');
  else if (tryGit(['cat-file', '-t', reviewed], { cwd }) !== 'commit')
    problems.push('reviewed_commit is not a commit in this repo');
  else {
    // No rename detection and unquoted paths, as lib.changedFiles: a reviewed file moved into the
    // ledger after review must show its deletion (verifier audit, second pass).
    const diffNames = (a, b) => {
      const out = tryGit(
        [
          '-c',
          'core.quotePath=false',
          'diff',
          '--no-renames',
          '--name-only',
          '-z',
          a,
          b,
        ],
        { cwd }
      );
      return out === null ? null : out.split('\0').filter(Boolean);
    };
    const rawBytes = (ref, f) => {
      const r = run('git', ['show', `${ref}:${f}`], { cwd });
      return r.code === 0 ? r.stdout : null;
    };
    const diffRaw = diffNames(reviewed, sha);
    if (diffRaw === null)
      problems.push('binding diff from reviewed commit failed');
    // Only the files the release step itself writes with the receipt may differ from the reviewed
    // commit (run-phase release). Any other manifest (policy-hash.json, selftest.json, another
    // phase's gate) changed after review breaks the binding (Codex on P1 1f97dfb6).
    const releaseWritten = new Set(
      ['gate.json', 'review.json', 'handoff.md'].map(
        n => `release-receipts/manifests/${p}-${n}`
      )
    );
    // Only existing *.jsonl ledger files stay exempt (and only while they grow, checked below); a
    // new path under ledger/ is an ordinary change.
    const ledgerFile = f =>
      /^release-receipts\/ledger\/[^/]+\.jsonl$/.test(f) &&
      rawBytes(reviewed, f) !== null;
    const outside = names =>
      (names || []).filter(
        f => f !== file && !releaseWritten.has(f) && !ledgerFile(f)
      );
    let extra = outside(diffRaw);
    // The ledger may only grow after review: a rewritten or truncated row (for example a
    // human-intervention row) breaks the binding (verifier audit).
    // Untrimmed bytes, and the reviewed copy must end on a row boundary, so the last row at review
    // cannot be edited in place (a trimmed comparison let '...}' become '...}x').
    for (const f of (diffRaw || []).filter(ledgerFile)) {
      const before = rawBytes(reviewed, f);
      const after = rawBytes(sha, f);
      if (
        after === null ||
        (before.length > 0 && !before.endsWith('\n')) ||
        !after.startsWith(before)
      )
        problems.push(`ledger ${f} rewritten after review (append-only)`);
    }
    // A merge commit on main (merge-phase merges with --merge) also carries whatever main gained
    // after the branch was cut (P0 #1005 after #998). It passes only as a PURE merge: one parent is
    // bound to the reviewed commit, every file the merge changes against that parent equals another
    // parent's copy, and every other parent is already on main, so what it brings was released on
    // its own (CodeRabbit on PR #1015: a merge could copy unreviewed source from an arbitrary
    // parent). No main ref to check against means not pure (fail closed).
    if (extra.length) {
      const mainRef = ['refs/remotes/origin/main', 'refs/heads/main'].find(
        ref => tryGit(['rev-parse', '--verify', '-q', ref], { cwd })
      );
      const onMain = c =>
        Boolean(mainRef) &&
        tryGit(['merge-base', '--is-ancestor', c, mainRef], { cwd }) !== null;
      const parents = (tryGit(['rev-parse', `${sha}^@`], { cwd }) || '')
        .split('\n')
        .filter(Boolean);
      const blob = (c, f) => tryGit(['rev-parse', `${c}:${f}`], { cwd });
      const pure =
        parents.length > 1 &&
        parents.some(p => {
          if (outside(diffNames(reviewed, p)).length) return false;
          const others = parents.filter(o => o !== p);
          if (!others.every(onMain)) return false;
          const merged = diffNames(p, sha) || [];
          // A file the merge changes must come from a parent that itself changed it since the
          // merge base, as a real three-way merge would take it; equal-but-unchanged (an old main
          // ancestor, or a deletion both sides lack) is a revert, not a merge (verifier audit).
          return merged.every(f =>
            others.some(o => {
              const mb = tryGit(['merge-base', p, o], { cwd });
              return (
                Boolean(mb) &&
                blob(o, f) === blob(sha, f) &&
                blob(o, f) !== blob(mb, f)
              );
            })
          );
        });
      if (pure) extra = [];
    }
    if (extra.length)
      problems.push(
        `diff from reviewed commit holds more than the receipt: ${extra.slice(0, 5).join(', ')}`
      );
    const tree = tryGit(['rev-parse', `${reviewed}^{tree}`], { cwd });
    if (!tree || !r.tested_tree || r.tested_tree !== tree)
      problems.push(
        `tested_tree ${String(r.tested_tree).slice(0, 12)} != tree of reviewed commit ${String(tree).slice(0, 12)}`
      );
  }
  if (typeof r.review_report !== 'string' || !r.review_report.trim())
    problems.push(
      'receipt names no review report (an independent review is required)'
    );
  else {
    const rep = tryGit(['show', `${sha}:${r.review_report}`], { cwd });
    if (rep === null)
      problems.push(`review report ${r.review_report} absent at head`);
    else {
      try {
        const j = JSON.parse(rep);
        const bound = String(j.head_sha || j.head || '');
        if (!bound) problems.push('review report names no head');
        else if (bound !== String(r.reviewed_commit))
          problems.push(
            'review report does not name the reviewed commit (full 40-hex SHA required)'
          );
        if (!('verdict' in j)) problems.push('review report has no verdict');
        else if (!/^(pass|approve)$/i.test(String(j.verdict).trim()))
          problems.push(`review verdict ${j.verdict}`);
        const failed = (Array.isArray(j.checklist) ? j.checklist : []).filter(
          c => String(c?.verdict || '').toUpperCase() === 'FAIL'
        );
        if (failed.length)
          problems.push(
            `review checklist has FAIL items: ${failed.map(c => c.id).join(', ')}`
          );
        const blocking = j.blocking_findings ?? j.findings ?? [];
        if (Array.isArray(blocking) ? blocking.length : blocking)
          problems.push(
            `review report carries ${Array.isArray(blocking) ? blocking.length : 'some'} blocking finding(s)`
          );
      } catch {
        problems.push('review report not JSON');
      }
    }
  }
  return { ok: problems.length === 0, problems, receipt: r, sha, phase: p };
}
function detectPhase(sha, cwd) {
  const files = (
    tryGit(['show', '--name-only', '--format=', sha], { cwd }) || ''
  ).split('\n');
  for (const f of files) {
    const m = /^release-receipts\/(P-?\d+)\.json$/.exec(f.trim());
    if (m) return m[1];
  }
  return null;
}
export function write({
  phase,
  reviewed,
  reviewReport,
  gate,
  humanActs = [],
  costLedgerSlice,
  cwd = ROOT,
}) {
  const tree = git(['rev-parse', `${reviewed}^{tree}`], { cwd });
  const state = gate.every(g => g.state === 'PASS' || g.required === false)
    ? 'PASS'
    : gate.some(g => g.state === 'INCONCLUSIVE')
      ? 'INCONCLUSIVE'
      : 'FAIL';
  const receipt = {
    schema: 'synthex-release-receipt/1',
    phase,
    written_at: new Date().toISOString(),
    reviewed_commit: reviewed,
    tested_tree: tree,
    review_report: reviewReport,
    cost_ledger: costLedgerSlice || {
      file: policy().ledger,
      rows: ledgerRows().filter(r => r.phase === phase).length,
    },
    gate,
    human_acts: humanActs,
    human_intervention_count: humanActs.length,
    policy_hash: sha256(
      readFileSync(path.join(cwd, 'scripts/fleet/policy.json'))
    ),
    state,
  };
  writeJson(path.join(cwd, `release-receipts/${phase}.json`), receipt);
  return receipt;
}
function fs_appendLedger(dir, row) {
  appendFileSync(path.join(dir, 'release-receipts/ledger/fleet.jsonl'), row);
}
function control() {
  // A: no receipt at head must fail. B and C exercise the rule-B3 binding in a scratch repo:
  // a head that differs from the reviewed commit by the receipt alone passes (B), and the
  // same receipt with any other file changed after review fails on the binding (C).
  const okA = verify(git(['rev-parse', 'HEAD']), 'P99').ok === false;
  const dir = mkdtempSync(path.join(tmpdir(), 'receipt-control-'));
  try {
    const g = a => git(a, { cwd: dir });
    const id = ['-c', 'user.name=control', '-c', 'user.email=control@local'];
    g(['init', '-q']);
    // verify() also requires the phase contract at head and its commands PASS in the receipt gate.
    mkdirSync(path.join(dir, 'scripts/fleet/contracts'), { recursive: true });
    writeFileSync(
      path.join(dir, 'scripts/fleet/contracts/P99.json'),
      JSON.stringify({ cumulative_gate: ['true'], criteria: [] })
    );
    mkdirSync(path.join(dir, 'release-receipts/ledger'), { recursive: true });
    writeFileSync(
      path.join(dir, 'release-receipts/ledger/fleet.jsonl'),
      '{"kind":"human-intervention","phase":"P99"}\n'
    );
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'root']);
    const root = g(['rev-parse', 'HEAD']);
    writeFileSync(path.join(dir, 'a.txt'), 'reviewed\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'reviewed']);
    const reviewed = g(['rev-parse', 'HEAD']);
    const report = 'release-receipts/manifests/P99-review.json';
    const receipt = over =>
      JSON.stringify({
        phase: 'P99',
        reviewed_commit: reviewed,
        tested_tree: g(['rev-parse', `${reviewed}^{tree}`]),
        review_report: report,
        cost_ledger: {},
        gate: [{ cmd: 'true', state: 'PASS' }],
        state: 'PASS',
        ...over,
      });
    mkdirSync(path.join(dir, 'release-receipts/manifests'), {
      recursive: true,
    });
    writeFileSync(
      path.join(dir, report),
      JSON.stringify({
        head_sha: reviewed,
        verdict: 'PASS',
        blocking_findings: [],
      })
    );
    writeFileSync(path.join(dir, 'release-receipts/P99.json'), receipt({}));
    fs_appendLedger(dir, '{"kind":"review","phase":"P99"}\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'receipt']);
    const okB = verify(g(['rev-parse', 'HEAD']), 'P99', dir).ok === true;
    writeFileSync(path.join(dir, 'a.txt'), 'changed after review\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'post-review change']);
    const c = verify(g(['rev-parse', 'HEAD']), 'P99', dir);
    const okC =
      c.ok === false &&
      c.problems.some(x => x.startsWith('diff from reviewed commit'));
    // D: a pure merge of the receipt head with a main that moved after review passes. E: the same
    // merge with a change made inside the merge commit fails on the binding.
    g([...id, 'reset', '-q', '--hard', 'HEAD~1']);
    const receiptHead = g(['rev-parse', 'HEAD']);
    g(['checkout', '-q', '-b', 'moved-main', reviewed]);
    writeFileSync(path.join(dir, 'b.txt'), 'landed on main after review\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'main moved']);
    g(['branch', '-f', 'main', 'HEAD']);
    g([
      ...id,
      'merge',
      '-q',
      '--no-ff',
      '-m',
      'merge receipt head',
      receiptHead,
    ]);
    const okD = verify(g(['rev-parse', 'HEAD']), 'P99', dir).ok === true;
    writeFileSync(path.join(dir, 'a.txt'), 'changed inside the merge\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '--amend', '--no-edit']);
    const e = verify(g(['rev-parse', 'HEAD']), 'P99', dir);
    const okE =
      e.ok === false &&
      e.problems.some(x => x.startsWith('diff from reviewed commit'));
    // F: a manifest the release step does not write (policy-hash.json), changed after review, fails.
    g([...id, 'checkout', '-q', '--detach', receiptHead]);
    mkdirSync(path.join(dir, 'release-receipts/manifests'), {
      recursive: true,
    });
    writeFileSync(
      path.join(dir, 'release-receipts/manifests/policy-hash.json'),
      '{"sha256":"changed after review"}\n'
    );
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'manifest changed after review']);
    const f = verify(g(['rev-parse', 'HEAD']), 'P99', dir);
    const okF =
      f.ok === false &&
      f.problems.some(x => x.startsWith('diff from reviewed commit'));
    // G: a merge that copies an unreviewed source change from a parent that is not on main fails.
    g(['checkout', '-q', '-b', 'unreviewed', reviewed]);
    writeFileSync(path.join(dir, 'a.txt'), 'unreviewed change\n');
    g(['add', '-A']);
    g([...id, 'commit', '-q', '-m', 'unreviewed']);
    g(['checkout', '-q', '--detach', receiptHead]);
    g([
      ...id,
      'merge',
      '-q',
      '--no-ff',
      '-X',
      'theirs',
      '-m',
      'copy from unreviewed parent',
      'unreviewed',
    ]);
    const gv = verify(g(['rev-parse', 'HEAD']), 'P99', dir);
    const okG =
      gv.ok === false &&
      gv.problems.some(x => x.startsWith('diff from reviewed commit'));
    // H: the same receipt with no review report fails. I: a receipt commit that rewrites the
    // ledger (drops the human-intervention row) fails. J: a merge whose other parent is an old
    // main ancestor, deleting a reviewed file, fails. K: a short reviewed_commit fails.
    const variant = (over, mutate) => {
      g(['checkout', '-q', '-f', '--detach', receiptHead]);
      writeFileSync(path.join(dir, 'release-receipts/P99.json'), receipt(over));
      if (mutate) mutate();
      g(['add', '-A']);
      g([...id, 'commit', '-q', '--allow-empty', '-m', 'variant']);
      return verify(g(['rev-parse', 'HEAD']), 'P99', dir);
    };
    const h = variant({ review_report: null });
    const okH = !h.ok && h.problems.some(x => x.includes('no review report'));
    const i = variant({}, () =>
      writeFileSync(
        path.join(dir, 'release-receipts/ledger/fleet.jsonl'),
        '{"kind":"review","phase":"P99"}\n'
      )
    );
    const okI = !i.ok && i.problems.some(x => x.includes('append-only'));
    const i2 = variant({}, () =>
      writeFileSync(
        path.join(dir, 'release-receipts/ledger/fleet.jsonl'),
        '{"kind":"human-intervention","phase":"P99"}x\n{"kind":"review","phase":"P99"}\n'
      )
    );
    const okI2 = !i2.ok && i2.problems.some(x => x.includes('append-only'));
    const i3 = variant({}, () =>
      g(['mv', 'a.txt', 'release-receipts/ledger/a.txt'])
    );
    const okI3 =
      !i3.ok &&
      i3.problems.some(x => x.startsWith('diff from reviewed commit'));
    g(['checkout', '-q', '-f', '--detach', receiptHead]);
    g(['rm', '-q', 'a.txt']);
    const revertTree = g(['write-tree']);
    const revert = g([
      ...id,
      'commit-tree',
      revertTree,
      '-p',
      receiptHead,
      '-p',
      root,
      '-m',
      'revert via old ancestor',
    ]);
    g(['checkout', '-q', '-f', '--detach', receiptHead]);
    const jv = verify(revert, 'P99', dir);
    const okJ =
      !jv.ok &&
      jv.problems.some(x => x.startsWith('diff from reviewed commit'));
    const k = variant({ reviewed_commit: reviewed.slice(0, 12) });
    const okK =
      !k.ok &&
      k.problems.some(x =>
        x.startsWith('reviewed_commit is not a full 40-hex')
      );
    return (
      okA &&
      okB &&
      okC &&
      okD &&
      okE &&
      okF &&
      okG &&
      okH &&
      okI &&
      okI2 &&
      okI3 &&
      okJ &&
      okK
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const ok = control();
    console.log(
      `${ok ? 'PASS' : 'FAIL'} verify-receipt negative control (absent receipt rejected, receipt-only head passes, post-review change rejected, pure merge with a moved main passes, change inside the merge rejected, other manifest changed after review rejected, merge copying from an unreviewed parent rejected, no review report / ledger rewrite / old-ancestor revert / short reviewed_commit rejected)`
    );
    process.exit(ok ? 0 : 1);
  }
  if (args.includes('--write')) {
    const phase = opt('--phase');
    const reviewed = opt('--reviewed');
    // The gate manifest is { phase, head, tree, at, results[] }; the receipt carries the results
    // array and must be written for the head the gate actually ran on.
    const gateDoc = readJson(opt('--gate'));
    const gate = Array.isArray(gateDoc) ? gateDoc : gateDoc.results || [];
    if (
      gateDoc.head &&
      !String(gateDoc.head).startsWith(reviewed.slice(0, 12))
    ) {
      console.log(
        `FAIL gate manifest head ${gateDoc.head} is not the reviewed commit ${reviewed}`
      );
      process.exit(1);
    }
    const r = write({
      phase,
      reviewed,
      reviewReport: opt('--report', null),
      gate,
      humanActs: opt('--human-acts') ? readJson(opt('--human-acts')) : [],
    });
    console.log(`wrote release-receipts/${phase}.json state=${r.state}`);
    process.exit(r.state === 'PASS' ? 0 : 1);
  }
  const head = opt('--head');
  if (!head) {
    console.error(
      'usage: --head <sha> [--phase P<n>] | --write --phase P<n> --reviewed <sha> --gate <json> [--report <path>] | --control'
    );
    process.exit(2);
  }
  let res;
  try {
    res = verify(head, opt('--phase'), path.resolve(opt('--repo', ROOT)));
  } catch (e) {
    console.log(`INCONCLUSIVE verify-receipt: ${e.message}`);
    process.exit(2);
  }
  if (res.ok) {
    console.log(
      `PASS verify-receipt ${res.phase} bound to ${res.sha.slice(0, 12)} (reviewed ${String(res.receipt.reviewed_commit).slice(0, 12)})`
    );
    process.exit(0);
  }
  for (const p of res.problems) console.log(`FAIL verify-receipt: ${p}`);
  process.exit(1);
}
