#!/usr/bin/env node
/**
 * scripts/fleet/merge-phase.mjs --pr <number> --head <sha> --phase P<n> [--dry-run] | --control
 *
 * The one sanctioned merge path (DECISIONS.md FD-3: the founder ratified fleet merges).
 * Merges only when ALL hold, each re-read live at call time:
 *   1. no security STOP and no daily halt;
 *   2. the PR head equals --head and that head carries the phase receipt, verify-receipt exits 0;
 *   3. every GitHub check on that exact head concluded success (none pending, none failed, none skipped among required contexts);
 *   4. the independent review report named in the receipt names the same head and passes;
 *   5. the PR base is main and the branch name matches the fleet pattern;
 *   6. attest-phase exits 0 for the branch.
 * Then: gh pr merge --merge --delete-branch (a merge commit keeps the receipt commit reachable from
 * main, so verify-receipt can re-check it after main moves), ledger row kind=merge, exit 0. Anything else exits 1 and merges nothing.
 */
import os from 'node:os';
import {
  policy,
  run,
  ROOT,
  ledgerAppend,
  haltState,
  readJson,
} from './lib.mjs';
const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : d;
};
// The review report must PASS and name the reviewed commit, as head_sha (schema 2, Codex) or head
// (run-phase adds it). A report with no head, or a head shorter than 12 characters, never binds:
// an empty head used to satisfy reviewed_commit.startsWith('') (Codex on P1 b8698d17).
export function reviewBound(rep, reviewedCommit) {
  const bound = String(rep?.head_sha || rep?.head || '');
  const reviewed = String(reviewedCommit || '');
  return (
    bound.length >= 12 &&
    reviewed.length >= 12 &&
    (reviewed.startsWith(bound) || bound.startsWith(reviewed)) &&
    /^(PASS|APPROVE)/i.test(String(rep?.verdict || ''))
  );
}
if (a.includes('--control')) {
  const c = 'b8698d17c295d0c31ddd17d452730331e84bdc37';
  const cases = [
    ['schema 2 head_sha PASS', { verdict: 'PASS', head_sha: c }, true],
    ['head PASS', { verdict: 'PASS', head: c.slice(0, 12) }, true],
    ['no head', { verdict: 'PASS' }, false],
    ['empty head', { verdict: 'PASS', head: '' }, false],
    ['short head', { verdict: 'PASS', head: c.slice(0, 7) }, false],
    ['other commit', { verdict: 'PASS', head_sha: 'a'.repeat(40) }, false],
    ['FAIL verdict', { verdict: 'FAIL', head_sha: c }, false],
  ];
  const bad = cases.filter(([, rep, want]) => reviewBound(rep, c) !== want);
  for (const [name] of bad) console.log(`FAIL control: ${name}`);
  console.log(
    `${bad.length ? 'FAIL' : 'PASS'} merge-phase review-binding control (${cases.length - bad.length}/${cases.length})`
  );
  process.exit(bad.length ? 1 : 0);
}
const pr = opt('--pr');
const head = opt('--head');
const phase = opt('--phase');
const dry = a.includes('--dry-run');
if (!pr || !head || !phase) {
  console.error('usage: --pr <n> --head <sha> --phase P<n> [--dry-run]');
  process.exit(2);
}
const pol = policy();
const gates = [];
const gate = (id, ok, detail) => {
  gates.push({ id, state: ok ? 'PASS' : 'FAIL', detail });
  console.log(
    `${ok ? 'PASS' : 'FAIL'} merge-gate ${id}${detail ? ' — ' + detail : ''}`
  );
  return ok;
};
// Review threads (bots such as CodeRabbit, Bugbot). main requires every conversation resolved. With
// no human to click, each unresolved thread needs a written disposition from the orchestrator:
// --threads <json> = [{ id, disposition: fixed|answered|deferred, reply }]. The reply is posted and
// the thread resolved; a thread without a disposition refuses the merge and is listed.
function listThreads() {
  const q = `query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){pageInfo{hasNextPage} nodes{id isResolved path line comments(first:1){nodes{author{login} body}}}}}}}`;
  const repo = (
    run('gh', [
      'repo',
      'view',
      '--json',
      'nameWithOwner',
      '--jq',
      '.nameWithOwner',
    ]).stdout || ''
  ).trim();
  const [o, n] = repo.split('/');
  const r = run('gh', [
    'api',
    'graphql',
    '-f',
    `query=${q}`,
    '-F',
    `o=${o}`,
    '-F',
    `n=${n}`,
    '-F',
    `p=${pr}`,
  ]);
  try {
    const rt = JSON.parse(r.stdout).data.repository.pullRequest.reviewThreads;
    if (rt.pageInfo?.hasNextPage) return null; // more than one page: fail closed rather than miss threads
    return rt.nodes.filter(t => !t.isResolved);
  } catch {
    return null;
  }
}
function resolveThreads() {
  const file = opt('--threads');
  const dispositions = file ? readJson(file, []) : [];
  const open = listThreads();
  if (open === null)
    return { ok: false, detail: 'could not list review threads' };
  let resolved = 0;
  const left = [];
  for (const t of open) {
    const d = dispositions.find(x => x.id === t.id);
    if (
      !d ||
      !d.reply ||
      !['fixed', 'answered', 'deferred'].includes(d.disposition)
    ) {
      left.push(
        `${t.path}:${t.line} (${t.comments.nodes[0]?.author?.login || '?'}) ${t.id}`
      );
      continue;
    }
    if (dry) {
      resolved++;
      continue;
    }
    const body = `[fleet orchestrator, ${d.disposition}] ${d.reply}`;
    const a = run('gh', [
      'api',
      'graphql',
      '-f',
      `query=mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}}`,
      '-F',
      `t=${t.id}`,
      '-F',
      `b=${body}`,
    ]);
    const r = run('gh', [
      'api',
      'graphql',
      '-f',
      `query=mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}`,
      '-F',
      `t=${t.id}`,
    ]);
    if (a.code === 0 && r.code === 0 && /"isResolved":true/.test(r.stdout))
      resolved++;
    else left.push(`${t.path}:${t.line} ${t.id} (reply/resolve failed)`);
  }
  ledgerAppend({
    kind: 'threads',
    phase,
    pr,
    head,
    resolved,
    unresolved: left.length,
  });
  return {
    ok: left.length === 0,
    detail: `${open.length} open, ${resolved} dispositioned${dry ? ' (dry-run)' : ''}, ${left.length} without disposition${left.length ? ': ' + left.slice(0, 5).join('; ') : ''}`,
  };
}

const h = haltState();
gate(
  'halt',
  !h.halted,
  h.security
    ? 'security STOP present'
    : h.daily
      ? 'daily ceiling halt'
      : 'clear'
);
const prj = run('gh', [
  'pr',
  'view',
  pr,
  '--json',
  'headRefOid,headRefName,baseRefName,state,mergeable,isDraft',
]);
let p = null;
try {
  p = JSON.parse(prj.stdout);
} catch {}
gate('pr-readable', !!p, prj.stderr.trim().slice(0, 120));
if (p) {
  gate(
    'head-matches',
    p.headRefOid === head,
    `${p.headRefOid?.slice(0, 12)} vs ${head.slice(0, 12)}`
  );
  gate(
    'base-main',
    p.baseRefName === 'main' && p.state === 'OPEN' && !p.isDraft,
    `${p.baseRefName} ${p.state}${p.isDraft ? ' draft' : ''}`
  );
  gate(
    'branch-pattern',
    new RegExp(pol.branch_pattern).test(p.headRefName),
    p.headRefName
  );
}
const vr = run(process.execPath, [
  'scripts/release/verify-receipt.mjs',
  '--head',
  head,
  '--phase',
  phase,
]);
gate('receipt', vr.code === 0, vr.stdout.trim().split('\n').pop());
const checks = run('gh', [
  'api',
  `repos/{owner}/{repo}/commits/${head}/check-runs?per_page=100`,
  '--jq',
  '{total: .total_count, runs: [.check_runs[] | {name, status, conclusion}]}',
]);
// GitHub pages check-runs; a read whose count differs from total_count is not evidence.
let cr = [];
let partial = true;
try {
  const j = JSON.parse(checks.stdout);
  cr = j.runs;
  partial = j.total !== cr.length;
} catch {}
if (!Array.isArray(cr)) cr = []; // an unknown head yields null, not a list
const pending = cr.filter(c => c.status !== 'completed');
const failed = cr.filter(
  c =>
    c.status === 'completed' &&
    !['success', 'neutral', 'skipped'].includes(c.conclusion)
);
const required = ['Build', 'Lint', 'Protected paths', 'Receipt verify'];
const missingReq = required.filter(
  n => !cr.some(c => c.name === n && c.conclusion === 'success')
);
gate(
  'checks',
  cr.length > 0 &&
    !partial &&
    !pending.length &&
    !failed.length &&
    !missingReq.length,
  `${cr.length} checks${partial ? ' (partial read)' : ''}, pending=${pending.map(c => c.name).join('|') || 'none'}, failed=${failed.map(c => c.name).join('|') || 'none'}, missing-required=${missingReq.join('|') || 'none'}`
);
const receipt = readJson(`release-receipts/${phase}.json`, null);
let rep = null;
try {
  rep = receipt?.review_report ? readJson(receipt.review_report) : null;
} catch {}
gate(
  'review',
  !!rep && reviewBound(rep, receipt?.reviewed_commit),
  rep
    ? `${rep.lane || rep.vendor || 'lane'} ${rep.verdict} @ ${String(rep.head_sha || rep.head).slice(0, 12)}`
    : 'no report'
);
const at = run(process.execPath, [
  'scripts/fleet/attest-phase.mjs',
  '--phase',
  phase,
]);
gate('attest', at.code === 0, at.stdout.trim().split('\n').pop());
// Only disposition threads once every other gate holds; replies are outward-facing.
const th = gates.every(g => g.state === 'PASS')
  ? resolveThreads()
  : { ok: false, detail: 'skipped: an earlier gate failed' };
gate('threads', th.ok, th.detail);
const ok = gates.every(g => g.state === 'PASS');
if (!ok) {
  ledgerAppend({ kind: 'merge-refused', phase, pr, head, gates });
  console.log(
    `merge-phase: refused (${gates
      .filter(g => g.state !== 'PASS')
      .map(g => g.id)
      .join(',')})`
  );
  process.exit(1);
}
if (dry) {
  console.log('merge-phase: all gates PASS (dry run, not merging)');
  process.exit(0);
}
const repoFull = (
  run('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]).stdout || ''
).trim();
// Explicit repo + cwd outside the checkout: gh then merges and deletes the remote branch without
// switching this working tree (P-1 reported exit 1 after a successful merge for that reason).
const m = run(
  'gh',
  [
    'pr',
    'merge',
    pr,
    '-R',
    repoFull,
    '--merge',
    '--delete-branch',
    '--match-head-commit',
    head,
  ],
  { timeout: 180000, cwd: os.tmpdir() }
);
ledgerAppend({
  kind: m.code === 0 ? 'merge' : 'merge-refused',
  phase,
  pr,
  head,
  gates,
  actor_is_fleet: true,
  ratified_by: 'FD-3',
  detail: m.code === 0 ? undefined : (m.stderr || m.stdout).slice(0, 300),
});
console.log(
  m.code === 0
    ? `PASS merge-phase: merged PR #${pr} at ${head.slice(0, 12)}`
    : `FAIL merge-phase: gh pr merge exit ${m.code}: ${(m.stderr || m.stdout).trim().slice(0, 300)}`
);
process.exit(m.code === 0 ? 0 : 1);
