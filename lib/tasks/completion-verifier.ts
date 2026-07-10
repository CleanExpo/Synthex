/**
 * Completion verifier — the ONLY path to "Done" for autonomous tasks
 * (SYN-MCP-005 / SYN-1081).
 *
 * ── Task lifecycle state machine (single source of truth) ───────────────────
 *
 *   enqueued ──worker-start──▶ running
 *   running  ──agent-success─▶ in_review   (worker/shell runner move the
 *   running  ──agent-failure─▶ enqueued     Linear issue to "In Review" +
 *                                           post an evidence comment; they
 *                                           NEVER mark Done)
 *   in_review ──verify-pass──▶ done        (this module, after proving
 *                                           CompletionEvidence via GitHub)
 *   in_review ──verify-fail──▶ in_review   (stays put + reject comment)
 *   done = terminal.
 *
 * The verifier's caller is the interim cron sweep
 * (app/api/cron/task-lifecycle/route.ts): it walks "In Review" issues that
 * carry an autonomous label, finds their PR link, calls `verifyCompletion`,
 * and only a green verdict may invoke `transitionIssueDone`.
 *
 * ── Evidence policy (bench must_fix 6) ──────────────────────────────────────
 * The OBJECTIVE evidence legs are (a) the PR exists on GitHub and (b) its
 * head commit's check-runs all succeeded — both read live from the GitHub
 * REST API. `acceptanceResults[]` are SELF-ATTESTED by the agent and are
 * recorded in the evidence for humans, but NEVER gate the verdict.
 *
 * ── Token policy (bench must_fix 7) ─────────────────────────────────────────
 * Uses TASK_VERIFIER_GITHUB_TOKEN — a NEW fine-grained PAT with READ-ONLY
 * scopes (Pull requests: Read, Checks: Read) on the target repo. Plain-fetch
 * pattern per lib/dr-repo-writer/github-client.ts. Deliberately NO fallback
 * to DR_REPO_GITHUB_TOKEN (that token can write).
 */

import { logger } from '@/lib/logger';
import { getLinearClient } from '@/lib/linear/client';
import type { TaskEnvelope } from '@/lib/tasks/task-envelope';
import { parseTaskEnvelope } from '@/lib/tasks/task-envelope';

const GITHUB_API = 'https://api.github.com';

export const TASK_VERIFIER_TOKEN_ENV = 'TASK_VERIFIER_GITHUB_TOKEN';

// ─── State machine ───────────────────────────────────────────────────────────

export type LifecycleState = 'enqueued' | 'running' | 'in_review' | 'done';
export type LifecycleEvent =
  | 'worker-start'
  | 'agent-success'
  | 'agent-failure'
  | 'verify-pass'
  | 'verify-fail';

export const LIFECYCLE_TRANSITIONS: ReadonlyArray<{
  from: LifecycleState;
  event: LifecycleEvent;
  to: LifecycleState;
}> = [
  { from: 'enqueued', event: 'worker-start', to: 'running' },
  { from: 'running', event: 'agent-success', to: 'in_review' },
  { from: 'running', event: 'agent-failure', to: 'enqueued' },
  { from: 'in_review', event: 'verify-pass', to: 'done' },
  { from: 'in_review', event: 'verify-fail', to: 'in_review' },
];

/** Pure transition function — returns null for any undefined transition. */
export function nextState(
  from: LifecycleState,
  event: LifecycleEvent
): LifecycleState | null {
  const hit = LIFECYCLE_TRANSITIONS.find(
    t => t.from === from && t.event === event
  );
  return hit ? hit.to : null;
}

// ─── Evidence types ──────────────────────────────────────────────────────────

export type CiStatus = 'success' | 'failure' | 'pending' | 'unknown';

export interface AcceptanceResult {
  criterion: string;
  passed: boolean;
  /** Always true — attested by the agent, not proven by this verifier. */
  selfAttested: true;
}

export interface CompletionEvidence {
  prUrl: string;
  ciStatus: CiStatus;
  /** SELF-ATTESTED — recorded for humans, never gates the verdict. */
  acceptanceResults: AcceptanceResult[];
  prState: 'open' | 'closed' | 'merged';
  headSha: string;
  checkedAt: string;
}

export type RejectReason =
  | 'invalid-envelope'
  | 'missing-pr-url'
  | 'invalid-pr-url'
  | 'pr-not-found'
  | 'ci-failure'
  | 'ci-pending'
  | 'no-ci-evidence'
  | 'github-error';

export type VerifyResult =
  | { verdict: 'accept'; evidence: CompletionEvidence }
  | {
      verdict: 'reject';
      reason: RejectReason;
      detail?: string;
      evidence?: Partial<CompletionEvidence>;
    };

// ─── GitHub plumbing ─────────────────────────────────────────────────────────

export interface PrCoords {
  owner: string;
  repo: string;
  number: number;
}

const PR_URL_RE = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/;

export function parsePrUrl(prUrl: string): PrCoords | null {
  const m = PR_URL_RE.exec(prUrl.trim());
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

function requireVerifierToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = env[TASK_VERIFIER_TOKEN_ENV];
  if (!token) {
    throw new Error(
      `[completion-verifier] ${TASK_VERIFIER_TOKEN_ENV} missing — configure a ` +
        `fine-grained READ-ONLY PAT (Pull requests: Read, Checks: Read). ` +
        `Never reuse a write-capable token here.`
    );
  }
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

interface GhPullResponse {
  state: 'open' | 'closed';
  merged: boolean;
  head: { sha: string };
}

interface GhCheckRunsResponse {
  total_count: number;
  check_runs: Array<{ status: string; conclusion: string | null }>;
}

const FAILING_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
  'stale',
]);
const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

/** Derive a single CiStatus from a set of check-runs. Exported for tests. */
export function deriveCiStatus(
  checkRuns: Array<{ status: string; conclusion: string | null }>
): CiStatus {
  if (checkRuns.length === 0) return 'unknown';
  if (checkRuns.some(r => r.status !== 'completed')) return 'pending';
  if (checkRuns.some(r => FAILING_CONCLUSIONS.has(r.conclusion ?? 'failure'))) {
    return 'failure';
  }
  if (checkRuns.every(r => PASSING_CONCLUSIONS.has(r.conclusion ?? ''))) {
    return 'success';
  }
  return 'unknown';
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface VerifyInput {
  prUrl?: string | null;
  /**
   * Optional self-attested acceptance results (from the agent's evidence
   * comment). When absent, envelope.acceptance is recorded as unattested
   * (passed: false). These NEVER gate the verdict — see evidence policy.
   */
  acceptanceResults?: Array<{ criterion: string; passed: boolean }>;
}

export interface VerifierDeps {
  fetchFn?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

/**
 * Prove (or refuse to prove) completion of the task described by `envelope`.
 * Accepts ONLY when the PR exists AND its head commit's check-runs are all
 * green. Everything else — missing PR, red CI, pending CI, zero CI evidence,
 * GitHub errors — is a reject, and the issue stays In Review.
 */
export async function verifyCompletion(
  envelope: TaskEnvelope | unknown,
  input: VerifyInput,
  deps: VerifierDeps = {}
): Promise<VerifyResult> {
  const parsed = parseTaskEnvelope(envelope);
  if (!parsed) {
    return { verdict: 'reject', reason: 'invalid-envelope' };
  }

  const fetchFn = deps.fetchFn ?? fetch;

  const attested = input.acceptanceResults
    ? input.acceptanceResults.map(r => ({
        criterion: r.criterion,
        passed: r.passed,
        selfAttested: true as const,
      }))
    : parsed.acceptance.map(criterion => ({
        criterion,
        passed: false,
        selfAttested: true as const,
      }));

  if (!input.prUrl) {
    return { verdict: 'reject', reason: 'missing-pr-url' };
  }

  const coords = parsePrUrl(input.prUrl);
  if (!coords) {
    return { verdict: 'reject', reason: 'invalid-pr-url', detail: input.prUrl };
  }

  const token = requireVerifierToken(deps.env);

  // Objective leg 1: the PR exists.
  const prRes = await fetchFn(
    `${GITHUB_API}/repos/${coords.owner}/${coords.repo}/pulls/${coords.number}`,
    { method: 'GET', headers: authHeaders(token) }
  );
  if (prRes.status === 404) {
    return { verdict: 'reject', reason: 'pr-not-found', detail: input.prUrl };
  }
  if (!prRes.ok) {
    return {
      verdict: 'reject',
      reason: 'github-error',
      detail: `pulls ${prRes.status} ${prRes.statusText}`,
    };
  }
  const pull = (await prRes.json()) as GhPullResponse;
  const prState: CompletionEvidence['prState'] = pull.merged
    ? 'merged'
    : pull.state;

  // Objective leg 2: the head commit's check-runs all succeeded.
  const checksRes = await fetchFn(
    `${GITHUB_API}/repos/${coords.owner}/${coords.repo}/commits/${pull.head.sha}/check-runs?per_page=100`,
    { method: 'GET', headers: authHeaders(token) }
  );
  if (!checksRes.ok) {
    return {
      verdict: 'reject',
      reason: 'github-error',
      detail: `check-runs ${checksRes.status} ${checksRes.statusText}`,
    };
  }
  const checks = (await checksRes.json()) as GhCheckRunsResponse;
  const ciStatus = deriveCiStatus(checks.check_runs ?? []);

  const evidence: CompletionEvidence = {
    prUrl: input.prUrl,
    ciStatus,
    acceptanceResults: attested,
    prState,
    headSha: pull.head.sha,
    checkedAt: new Date().toISOString(),
  };

  if (ciStatus === 'success') {
    return { verdict: 'accept', evidence };
  }
  const reason: RejectReason =
    ciStatus === 'failure'
      ? 'ci-failure'
      : ciStatus === 'pending'
        ? 'ci-pending'
        : 'no-ci-evidence';
  return { verdict: 'reject', reason, evidence };
}

// ─── Done transition — SINGLE WRITER ─────────────────────────────────────────
//
// DONE-TRANSITION-SINGLE-WRITER: `transitionIssueDone` below is the ONLY call
// site in the codebase allowed to move a Linear issue into a `completed`
// workflow state. The shell runner and the BullMQ worker had their Done
// writers removed in SYN-MCP-005; a regression test
// (tests/unit/lib/tasks/done-single-writer.test.ts) greps the lifecycle
// surfaces and fails if a completed-state transition appears anywhere else.

export const VERIFIER_COMMENT_TAG = 'completion-verifier';

/** Idempotency marker embedded in verifier comments (HTML comment, invisible). */
export function verifierCommentMarker(kind: string, headSha: string): string {
  return `<!-- ${VERIFIER_COMMENT_TAG}:${kind}:${headSha} -->`;
}

export function formatEvidenceComment(evidence: CompletionEvidence): string {
  const acceptance =
    evidence.acceptanceResults.length > 0
      ? evidence.acceptanceResults
          .map(
            r =>
              `- [${r.passed ? 'x' : ' '}] ${r.criterion} _(self-attested — not verified)_`
          )
          .join('\n')
      : '_none recorded_';
  return [
    verifierCommentMarker('done', evidence.headSha),
    '## ✅ Completion verified — moving to Done',
    '',
    `**PR:** ${evidence.prUrl} (${evidence.prState})`,
    `**CI:** \`${evidence.ciStatus}\` @ \`${evidence.headSha}\``,
    `**Checked:** ${evidence.checkedAt}`,
    '',
    '**Acceptance (self-attested by agent, objective legs are PR + CI):**',
    acceptance,
  ].join('\n');
}

interface LinearWorkflowStateNode {
  id: string;
  name: string;
  type: string;
}

export interface DoneTransitionDeps {
  linear?: {
    workflowStates: (args: {
      filter: { team: { id: { eq: string } } };
    }) => Promise<{ nodes: LinearWorkflowStateNode[] }>;
    issue: (
      id: string
    ) => Promise<{ team: Promise<{ id: string } | undefined> }>;
    updateIssue: (id: string, input: { stateId: string }) => Promise<unknown>;
    createComment: (input: {
      issueId: string;
      body: string;
    }) => Promise<unknown>;
  };
}

// Cache completed state IDs per team to avoid repeated API calls.
const completedStateCache = new Map<string, string>();

/**
 * THE single Done-writer. Posts the CompletionEvidence comment, then moves
 * the issue to the team's `completed` state. Callers MUST hold an `accept`
 * verdict from `verifyCompletion` — pass its evidence here.
 */
export async function transitionIssueDone(
  issueId: string,
  evidence: CompletionEvidence,
  deps: DoneTransitionDeps = {}
): Promise<{ ok: boolean; reason?: string }> {
  const linear = deps.linear ?? getLinearClient();

  const issue = await linear.issue(issueId);
  const team = await issue.team;
  if (!team) {
    return { ok: false, reason: 'issue-has-no-team' };
  }

  let stateId = completedStateCache.get(team.id);
  if (!stateId) {
    const states = await linear.workflowStates({
      filter: { team: { id: { eq: team.id } } },
    });
    const completed = states.nodes.find(s => s.type === 'completed');
    if (!completed) {
      return { ok: false, reason: 'no-completed-state' };
    }
    stateId = completed.id;
    completedStateCache.set(team.id, stateId);
  }

  await linear.createComment({
    issueId,
    body: formatEvidenceComment(evidence),
  });
  await linear.updateIssue(issueId, { stateId });
  logger.info('[completion-verifier] issue transitioned to Done', {
    issueId,
    prUrl: evidence.prUrl,
    headSha: evidence.headSha,
  });
  return { ok: true };
}

/** Test-only: reset the per-team completed-state cache. */
export function __resetCompletedStateCacheForTests(): void {
  completedStateCache.clear();
}
