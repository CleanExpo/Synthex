/**
 * Workflow audit trail (SYN-972) — the Audit leg of the agency loop
 * (Trigger → Artefact → Gate → Publish → AUDIT).
 *
 * Pure, read-only: derives a human-readable decision timeline from the
 * StepExecution rows the orchestrator already writes — who decided what, when,
 * and why (including the reject/revision reason). No new table, no migration;
 * this is the queryable "what did the agency OS do?" view a founder reviews.
 */

export type AuditOutcome =
  | 'auto_approved'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'awaiting_approval'
  | 'skipped'
  | 'in_progress';

/** Secret-free subset of a StepExecution row needed to build the trail. */
export interface AuditStepInput {
  stepIndex: number;
  stepName: string;
  stepType: string;
  status: string;
  autoApproved?: boolean | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  errorMessage?: string | null;
  outputData?: unknown;
  completedAt?: Date | string | null;
}

export interface WorkflowAuditEntry {
  stepIndex: number;
  stepName: string;
  stepType: string;
  outcome: AuditOutcome;
  /** Who made a human decision (approver / rejecter), when known. */
  actor?: string;
  /** ISO timestamp of the decision/outcome, when known. */
  at?: string;
  /** Reject/revision reason or failure message, when present. */
  detail?: string;
}

function toIso(v: Date | string | null | undefined): string | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

/** Pull a rejecter id out of the reused outputData JSON, when present. */
function rejectedBy(outputData: unknown): string | undefined {
  if (outputData && typeof outputData === 'object' && 'rejectedBy' in outputData) {
    const v = (outputData as { rejectedBy?: unknown }).rejectedBy;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

function classify(step: AuditStepInput): WorkflowAuditEntry {
  const base = {
    stepIndex: step.stepIndex,
    stepName: step.stepName,
    stepType: step.stepType,
  };

  switch (step.status) {
    case 'completed':
      return {
        ...base,
        outcome: step.autoApproved ? 'auto_approved' : 'approved',
        ...(step.approvedBy ? { actor: step.approvedBy } : {}),
        at: toIso(step.approvedAt ?? step.completedAt),
      };
    case 'rejected':
      return {
        ...base,
        outcome: 'rejected',
        ...(rejectedBy(step.outputData) ? { actor: rejectedBy(step.outputData) } : {}),
        at: toIso(step.completedAt),
        ...(step.errorMessage ? { detail: step.errorMessage } : {}),
      };
    case 'failed':
      return {
        ...base,
        outcome: 'failed',
        at: toIso(step.completedAt),
        ...(step.errorMessage ? { detail: step.errorMessage } : {}),
      };
    case 'waiting_approval':
      return { ...base, outcome: 'awaiting_approval' };
    case 'skipped':
      return { ...base, outcome: 'skipped', at: toIso(step.completedAt) };
    default:
      return { ...base, outcome: 'in_progress' };
  }
}

/**
 * Build the ordered audit timeline for a workflow execution from its steps.
 * Steps are returned in stepIndex order regardless of input ordering.
 */
export function buildWorkflowAuditTrail(
  steps: AuditStepInput[],
): WorkflowAuditEntry[] {
  return [...steps]
    .sort((a, b) => a.stepIndex - b.stepIndex)
    .map(classify);
}
