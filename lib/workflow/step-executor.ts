/**
 * Step Executor — Phase 62
 * Executes a single workflow step by routing to the correct step-type handler.
 *
 * Minions Principle 2: "The system runs the model"
 * This router is deterministic. AI logic lives in step-types/ (Phase 62-02).
 * The executor wraps execution, handles timeouts, and returns structured results.
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from './types'

/** Default step execution timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Execute a single step by its type.
 *
 * Routes to the appropriate step-type handler (implemented in Phase 62-02).
 * All step types return a StepResult — success or typed failure.
 *
 * @param stepDef  - The step definition from the workflow blueprint
 * @param context  - Token-budgeted context assembled by context-builder
 * @param timeoutMs - Execution timeout (default: 30s)
 */
export async function executeStep(
  stepDef: WorkflowStepDefinition,
  context: StepContext,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<StepResult> {
  const timeoutPromise = new Promise<StepResult>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Step "${stepDef.name}" timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  )

  const executionPromise = executeStepByType(stepDef, context)

  try {
    return await Promise.race([executionPromise, timeoutPromise])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: message,
      // Timeouts are not terminal — orchestrator may retry
      terminal: false,
    }
  }
}

/**
 * Route to the correct step-type handler.
 * Step-type implementations are added in Phase 62-02.
 */
async function executeStepByType(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  switch (stepDef.type) {
    case 'ai':
      return executeAiStep(stepDef, context)
    case 'approval':
      return executeApprovalStep(stepDef, context)
    case 'action':
      return executeActionStep(stepDef, context)
    case 'validation':
      return executeValidationStep(stepDef, context)
    default: {
      const exhaustive: never = stepDef.type
      return {
        success: false,
        error: `Unknown step type: ${exhaustive}`,
        terminal: true,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step type stubs — replaced with real implementations in Phase 62-02
// ---------------------------------------------------------------------------

async function executeAiStep(
  stepDef: WorkflowStepDefinition,
  _context: StepContext
): Promise<StepResult> {
  // Stub: Phase 62-02 will implement lib/workflow/step-types/ai-generate.ts etc.
  return {
    success: false,
    error: `AI step "${stepDef.name}" not yet implemented — coming in Phase 62-02`,
    terminal: true,
  }
}

async function executeApprovalStep(
  stepDef: WorkflowStepDefinition,
  _context: StepContext
): Promise<StepResult> {
  // Approval steps always pause for human review — not an error
  return {
    success: true,
    output: { waitingFor: 'human_approval', stepName: stepDef.name },
    confidenceScore: 1.0,
    requiresApproval: true,
  }
}

async function executeActionStep(
  stepDef: WorkflowStepDefinition,
  _context: StepContext
): Promise<StepResult> {
  // Stub: Phase 62-02 will implement action-publish, action-schedule, action-notify
  return {
    success: false,
    error: `Action step "${stepDef.name}" not yet implemented — coming in Phase 62-02`,
    terminal: true,
  }
}

async function executeValidationStep(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  // Basic validation: check prior steps completed successfully
  const failedPriorSteps = context.priorOutputs.filter(
    (s) => s.output && typeof s.output === 'object' && 'error' in (s.output as object)
  )
  if (failedPriorSteps.length > 0) {
    return {
      success: false,
      error: `Validation failed: ${failedPriorSteps.length} prior step(s) had errors`,
      terminal: false,
    }
  }
  return {
    success: true,
    output: { validated: true, priorStepsChecked: context.priorOutputs.length },
    confidenceScore: 1.0,
  }
}
