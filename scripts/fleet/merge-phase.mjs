#!/usr/bin/env node
/**
 * scripts/fleet/merge-phase.mjs --pr <number> --head <sha> --phase P<n> [--dry-run]
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
  const q = `query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){nodes{id isResolved path line comments(first:1){nodes{author{login} body}}}}}}}`;
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
    return JSON.parse(
      r.stdout
    ).data.repository.pullRequest.reviewThreads.nodes.filter(
      t => !t.isResolved
    );
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
  '[.check_runs[] | {name, status, conclusion}]',
]);
let cr = [];
try {
  cr = JSON.parse(checks.stdout);
} catch {}
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
  cr.length > 0 && !pending.length && !failed.length && !missingReq.length,
  `${cr.length} checks, pending=${pending.map(c => c.name).join('|') || 'none'}, failed=${failed.map(c => c.name).join('|') || 'none'}, missing-required=${missingReq.join('|') || 'none'}`
);
const receipt = readJson(`release-receipts/${phase}.json`, null);
let rep = null;
try {
  rep = receipt?.review_report ? readJson(receipt.review_report) : null;
} catch {}
gate(
  'review',
  !!rep &&
    (String(rep.head || '').startsWith(
      String(receipt.reviewed_commit).slice(0, 12)
    ) ||
      String(receipt.reviewed_commit).startsWith(String(rep.head || ''))) &&
    /^(PASS|APPROVE)/i.test(String(rep.verdict || '')),
  rep
    ? `${rep.lane || rep.vendor || 'lane'} ${rep.verdict} @ ${String(rep.head).slice(0, 12)}`
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
const m = run(
  'gh',
  [
    'pr',
    'merge',
    pr,
    '--merge',
    '--delete-branch',
    '--match-head-commit',
    head,
  ],
  { timeout: 180000 }
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
