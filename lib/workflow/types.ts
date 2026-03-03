/**
 * Workflow Engine Types — Phase 62
 * Minions-inspired: deterministic orchestrator + bounded AI steps
 */

// ---------------------------------------------------------------------------
// Step Definitions (the blueprint for what a step should do)
// ---------------------------------------------------------------------------

export type StepType = 'ai' | 'approval' | 'action' | 'validation'

export interface WorkflowStepDefinition {
  name: string
  type: StepType
  /** For AI steps: the prompt template. Use {{variable}} for interpolation. */
  promptTemplate?: string
  /** For action steps: which action to perform */
  actionType?: 'publish' | 'schedule' | 'notify'
  /** Metadata passed to the step executor */
  config?: Record<string, unknown>
  /** Override auto-approve threshold for this step (0.0–1.0) */
  autoApproveThreshold?: number
}

export interface WorkflowDefinition {
  title: string
  steps: WorkflowStepDefinition[]
  /** Default confidence threshold for auto-approval (default: 0.85) */
  autoApproveThreshold?: number
}

// ---------------------------------------------------------------------------
// Step Context (assembled by context-builder.ts before each AI step)
// ---------------------------------------------------------------------------

export interface PriorStepOutput {
  stepIndex: number
  stepName: string
  stepType: StepType
  output: unknown
  confidenceScore?: number
}

export interface StepContext {
  /** The step definition being executed */
  stepDefinition: WorkflowStepDefinition
  /** Token-budgeted prior outputs (last N steps only) */
  priorOutputs: PriorStepOutput[]
  /** The workflow's initial input data */
  workflowInput?: unknown
  /** Current step index (0-based) */
  stepIndex: number
  /** Total steps in the workflow */
  totalSteps: number
}

// ---------------------------------------------------------------------------
// Step Results (what a step executor returns)
// ---------------------------------------------------------------------------

export interface StepResultSuccess {
  success: true
  output: unknown
  /** Required for AI steps (0.0–1.0). Use 1.0 for deterministic action steps. */
  confidenceScore?: number
  /** If true, orchestrator will require human approval regardless of confidence */
  requiresApproval?: boolean
}

export interface StepResultFailure {
  success: false
  error: string
  /** If true, orchestrator will NOT retry this step */
  terminal?: boolean
}

export type StepResult = StepResultSuccess | StepResultFailure

// ---------------------------------------------------------------------------
// Orchestrator Gate Decision
// ---------------------------------------------------------------------------

export type GateDecision = 'auto_approve' | 'await_human' | 'failed'

export interface GateOutcome {
  decision: GateDecision
  reason: string
}

// ---------------------------------------------------------------------------
// Execution Status (mirrors Prisma model status strings)
// ---------------------------------------------------------------------------

export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
