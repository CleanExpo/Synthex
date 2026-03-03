/**
 * Step Executor — Phase 62
 * Executes a single workflow step by routing to the correct step-type handler.
 *
 * Minions Principle 2: "The system runs the model"
 * This router is deterministic. AI logic lives in step-types/ (Phase 62-02).
 * The executor wraps execution, handles timeouts, and returns structured results.
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from './types'
import { execute as executeAiGenerate } from './step-types/ai-generate'
import { execute as executeAiAnalyse } from './step-types/ai-analyse'
import { execute as executeAiEnrich } from './step-types/ai-enrich'
import { execute as executeHumanApproval } from './step-types/human-approval'
import { execute as executeActionPublish } from './step-types/action-publish'
import { execute as executeActionSchedule } from './step-types/action-schedule'
import { execute as executeActionNotify } from './step-types/action-notify'

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
// Step type handlers — wired to real implementations in Phase 62-02
// ---------------------------------------------------------------------------

async function executeAiStep(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  const subType = (stepDef.config as { subType?: string } | undefined)?.subType
  switch (subType) {
    case 'analyse':
      return executeAiAnalyse(stepDef, context)
    case 'enrich':
      return executeAiEnrich(stepDef, context)
    default:
      return executeAiGenerate(stepDef, context)
  }
}

async function executeApprovalStep(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  return executeHumanApproval(stepDef, context)
}

async function executeActionStep(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  switch (stepDef.actionType) {
    case 'publish':
      return executeActionPublish(stepDef, context)
    case 'schedule':
      return executeActionSchedule(stepDef, context)
    case 'notify':
      return executeActionNotify(stepDef, context)
    default:
      return { success: false, error: 'Unknown action type', terminal: true }
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
