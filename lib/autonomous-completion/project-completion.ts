/**
 * Autonomous project-completion loop (SYN-1035).
 *
 * When every required issue in an opted-in Linear project is terminal
 * (completed / canceled / accepted-blocked) and verification passed, post a final
 * completion summary and close the project. Otherwise leave it open with the
 * blocker visible.
 *
 * Two guards make "don't close broad roadmap projects on one batch" concrete and
 * testable (the prior review's unmeasurable-criterion concern):
 *   1. OPT-IN ONLY — a project is eligible solely when `autoCompleteEnabled` is
 *      explicitly true. Broad roadmap projects are never auto-discovered/closed.
 *   2. ALL-OR-NOTHING — every required issue must be terminal. A single active
 *      issue (Backlog / Todo / In Progress / In Review) blocks closure, so a
 *      partial batch can never trip it.
 *
 * The decision is pure; side effects (post update, close project) are injected,
 * so the loop is idempotent and safe to rerun.
 *
 * @module lib/autonomous-completion/project-completion
 */

/** Terminal vs active classification of a required issue. */
export type RequiredIssueState = 'completed' | 'canceled' | 'blocked' | 'active';

export interface RequiredIssue {
  id: string;
  identifier: string;
  title: string;
  state: RequiredIssueState;
  /** For `blocked` issues: a human-accepted reason turns it into a valid exclusion. */
  acceptedBlockReason?: string | null;
  /** Evidence links (Linear/Obsidian/agent-run/CRM) gathered into the summary. */
  evidenceRefs?: string[];
}

export interface ProjectCompletionInput {
  projectId: string;
  projectName: string;
  /** Opt-in guard — only explicitly enabled projects are eligible. */
  autoCompleteEnabled: boolean;
  /** Idempotency — project is already in a completed/closed state. */
  alreadyComplete: boolean;
  requiredIssues: RequiredIssue[];
  verification: { passed: boolean; detail?: string };
}

export type CompletionBlockReason =
  | 'not_opted_in'
  | 'no_required_issues'
  | 'open_issues'
  | 'unaccepted_blocks'
  | 'verification_failed';

export interface CompletionSummary {
  projectId: string;
  projectName: string;
  completedIssues: Array<{ identifier: string; title: string }>;
  blockedExclusions: Array<{ identifier: string; reason: string }>;
  canceledIssues: Array<{ identifier: string; title: string }>;
  evidenceLinks: string[];
  verification: { passed: boolean; detail?: string };
  /** Active issues / unaccepted blocks that prevent closure. */
  openRisks: string[];
}

export interface CompletionDecision {
  closeable: boolean;
  /** Idempotent no-op signal — already complete, nothing to do. */
  alreadyComplete: boolean;
  reasons: CompletionBlockReason[];
  blockers: Array<{ identifier: string; state: string; note: string }>;
  summary: CompletionSummary;
}

const TERMINAL: ReadonlySet<RequiredIssueState> = new Set(['completed', 'canceled', 'blocked']);

/** Build the final completion summary (always computable, even when not closeable). */
export function buildCompletionSummary(input: ProjectCompletionInput): CompletionSummary {
  const completedIssues = input.requiredIssues
    .filter(i => i.state === 'completed')
    .map(i => ({ identifier: i.identifier, title: i.title }));

  const canceledIssues = input.requiredIssues
    .filter(i => i.state === 'canceled')
    .map(i => ({ identifier: i.identifier, title: i.title }));

  const blockedExclusions = input.requiredIssues
    .filter(i => i.state === 'blocked' && Boolean(i.acceptedBlockReason))
    .map(i => ({ identifier: i.identifier, reason: i.acceptedBlockReason as string }));

  const evidenceLinks = Array.from(
    new Set(input.requiredIssues.flatMap(i => i.evidenceRefs ?? []))
  );

  const openRisks = input.requiredIssues
    .filter(i => i.state === 'active' || (i.state === 'blocked' && !i.acceptedBlockReason))
    .map(i =>
      i.state === 'active'
        ? `${i.identifier} still open (${i.title})`
        : `${i.identifier} blocked without an accepted reason`
    );

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    completedIssues,
    blockedExclusions,
    canceledIssues,
    evidenceLinks,
    verification: input.verification,
    openRisks,
  };
}

/** Decide whether an opted-in project's scoped work is complete enough to close. */
export function evaluateProjectCompletion(input: ProjectCompletionInput): CompletionDecision {
  const summary = buildCompletionSummary(input);

  // Idempotent short-circuit: already closed → nothing to do, safe to rerun.
  if (input.alreadyComplete) {
    return { closeable: false, alreadyComplete: true, reasons: [], blockers: [], summary };
  }

  const reasons: CompletionBlockReason[] = [];
  const blockers: CompletionDecision['blockers'] = [];

  if (!input.autoCompleteEnabled) reasons.push('not_opted_in');
  if (input.requiredIssues.length === 0) reasons.push('no_required_issues');

  for (const issue of input.requiredIssues) {
    if (issue.state === 'active') {
      blockers.push({ identifier: issue.identifier, state: 'active', note: 'still open' });
    } else if (issue.state === 'blocked' && !issue.acceptedBlockReason) {
      blockers.push({
        identifier: issue.identifier,
        state: 'blocked',
        note: 'blocked without an accepted reason',
      });
    }
  }

  if (blockers.some(b => b.state === 'active')) reasons.push('open_issues');
  if (blockers.some(b => b.state === 'blocked')) reasons.push('unaccepted_blocks');
  if (!input.verification.passed) reasons.push('verification_failed');

  // Closeable only when opted-in, has required issues, all terminal, verified.
  const allTerminal = input.requiredIssues.every(i => TERMINAL.has(i.state));
  const closeable =
    reasons.length === 0 &&
    input.autoCompleteEnabled &&
    input.requiredIssues.length > 0 &&
    allTerminal &&
    input.verification.passed;

  return { closeable, alreadyComplete: false, reasons, blockers, summary };
}

/** Render the completion summary as a Linear-ready markdown status update. */
export function formatCompletionSummary(summary: CompletionSummary): string {
  const lines: string[] = [
    `## Project completion summary — ${summary.projectName}`,
    '',
    `**Completed (${summary.completedIssues.length}):** ${
      summary.completedIssues.map(i => i.identifier).join(', ') || '—'
    }`,
  ];
  if (summary.canceledIssues.length) {
    lines.push(`**Canceled:** ${summary.canceledIssues.map(i => i.identifier).join(', ')}`);
  }
  if (summary.blockedExclusions.length) {
    lines.push(
      `**Accepted-blocked exclusions:** ${summary.blockedExclusions
        .map(b => `${b.identifier} (${b.reason})`)
        .join(', ')}`
    );
  }
  lines.push(
    `**Verification:** ${summary.verification.passed ? 'passed' : 'FAILED'}${
      summary.verification.detail ? ` — ${summary.verification.detail}` : ''
    }`,
    `**Evidence:** ${summary.evidenceLinks.join(', ') || '—'}`,
    `**Open risks:** ${summary.openRisks.join('; ') || 'none'}`
  );
  return lines.join('\n');
}

/** Injected side effects so the loop stays pure + testable. */
export interface CompletionEffects {
  postUpdate: (projectId: string, body: string) => Promise<void>;
  closeProject: (projectId: string) => Promise<void>;
}

export interface CompletionRunResult {
  closed: boolean;
  noop: boolean;
  decision: CompletionDecision;
}

/**
 * Evaluate and, when closeable, post the summary then close the project. Posts
 * the update BEFORE closing (AC). Idempotent: an already-complete project is a
 * no-op and fires no effects, so reruns are safe.
 */
export async function runProjectCompletion(
  input: ProjectCompletionInput,
  effects: CompletionEffects
): Promise<CompletionRunResult> {
  const decision = evaluateProjectCompletion(input);

  if (decision.alreadyComplete) {
    return { closed: false, noop: true, decision };
  }
  if (!decision.closeable) {
    return { closed: false, noop: false, decision };
  }

  await effects.postUpdate(input.projectId, formatCompletionSummary(decision.summary));
  await effects.closeProject(input.projectId);
  return { closed: true, noop: false, decision };
}
