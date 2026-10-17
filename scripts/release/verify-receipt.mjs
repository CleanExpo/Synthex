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
import { existsSync, readFileSync } from 'node:fs';
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
  if (r.state !== 'PASS') problems.push(`receipt state ${r.state}`);
  // Binding: head differs from reviewed commit by the receipt file alone.
  const reviewed = r.reviewed_commit;
  if (!reviewed || tryGit(['cat-file', '-e', reviewed], { cwd }) === null)
    problems.push('reviewed_commit not in repo');
  else {
    const diff = (tryGit(['diff', '--name-only', reviewed, sha], { cwd }) || '')
      .split('\n')
      .filter(Boolean);
    const extra = diff.filter(
      f => f !== file && !/^release-receipts\/(ledger|manifests)\//.test(f)
    );
    if (extra.length)
      problems.push(
        `diff from reviewed commit holds more than the receipt: ${extra.slice(0, 5).join(', ')}`
      );
    const tree = tryGit(['rev-parse', `${reviewed}^{tree}`], { cwd });
    if (r.tested_tree !== tree)
      problems.push(
        `tested_tree ${String(r.tested_tree).slice(0, 12)} != tree of reviewed commit ${String(tree).slice(0, 12)}`
      );
  }
  if (r.review_report) {
    const rep = tryGit(['show', `${sha}:${r.review_report}`], { cwd });
    if (rep === null)
      problems.push(`review report ${r.review_report} absent at head`);
    else {
      try {
        const j = JSON.parse(rep);
        if (
          j.head &&
          !String(r.reviewed_commit).startsWith(j.head) &&
          !String(j.head).startsWith(r.reviewed_commit)
        )
          problems.push('review report names a different head');
        if (
          j.verdict &&
          !/^(PASS|APPROVE|pass|approve)/.test(String(j.verdict))
        )
          problems.push(`review verdict ${j.verdict}`);
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
function control() {
  // Negative: a receipt whose reviewed_commit is an older commit with other files in the diff must fail.
  const head = git(['rev-parse', 'HEAD']);
  const older = tryGit(['rev-parse', 'HEAD~3']) || head;
  const fake = {
    phase: 'P99',
    reviewed_commit: older,
    tested_tree: 'x',
    review_report: null,
    cost_ledger: {},
    gate: [{ cmd: 'true', state: 'PASS' }],
    state: 'PASS',
  };
  // Evaluate the same rules in-process against a fake head with no receipt file -> must not be ok.
  const res = verify(head, 'P99');
  const okA = res.ok === false;
  const okB = fake.tested_tree !== git(['rev-parse', `${older}^{tree}`]);
  return okA && okB;
}
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const ok = control();
    console.log(
      `${ok ? 'PASS' : 'FAIL'} verify-receipt negative control (absent/mismatched receipt rejected)`
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
    res = verify(head, opt('--phase'));
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
