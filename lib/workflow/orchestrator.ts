/**
 * Workflow Orchestrator — Phase 62
 * The deterministic coordinator. Controls flow, checks gates, handles retries.
 *
 * Minions Principle 2: "The system runs the model"
 * This file contains ZERO AI calls. It routes execution, evaluates confidence
 * gates, enforces the 2-retry cap, and marks executions as complete/failed.
 *
 * Minions Principle 5: "Walls before models"
 * - 2-retry cap: retryCount >= 2 → surface to human, never loop
 * - Auto-approve gate: confidenceScore >= threshold (default 0.85)
 * - Mandatory human gate: requiresApproval=true always pauses
 */

import { prisma } from '@/lib/prisma'
import { buildStepContext } from './context-builder'
import { executeStep } from './step-executor'
import type { GateOutcome, StepResult, StepResultSuccess, WorkflowStepDefinition } from './types'

/** Default confidence threshold for auto-approval */
const DEFAULT_AUTO_APPROVE_THRESHOLD = 0.85

/** Maximum automatic retries per step before surfacing to human */
const MAX_RETRIES = 2

/**
 * Advance a workflow execution by one step.
 *
 * Flow:
 *   Load execution → find current step def → build context → execute step
 *   → evaluate gate → update DB → enqueue next step (or complete/fail)
 *
 * Called by the BullMQ worker (Phase 62-02) and by the approval route.
 */
export async function advanceWorkflow(workflowExecutionId: string): Promise<void> {
  // Load execution with current state
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: {
      id: true,
      status: true,
      currentStepIndex: true,
      totalSteps: true,
      inputData: true,
    },
  })

  // Guard: only advance if in a runnable state
  if (!['pending', 'running'].includes(execution.status)) {
    return
  }

  // Guard: all steps complete
  if (execution.currentStepIndex >= execution.totalSteps) {
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: 'completed', completedAt: new Date() },
    })
    return
  }

  const stepIndex = execution.currentStepIndex

  // Load or create the StepExecution record
  let stepExecution = await prisma.stepExecution.findFirst({
    where: { workflowExecutionId, stepIndex },
  })

  // Check retry cap BEFORE executing
  if (stepExecution && stepExecution.retryCount >= MAX_RETRIES) {
    // 2-retry cap hit — surface to human, never loop
    await prisma.stepExecution.update({
      where: { id: stepExecution.id },
      data: { status: 'failed', errorMessage: `Max retries (${MAX_RETRIES}) exceeded`, completedAt: new Date() },
    })
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'failed',
        errorMessage: `Step "${stepExecution.stepName}" failed after ${MAX_RETRIES} retries`,
        completedAt: new Date(),
      },
    })
    return
  }

  // Mark execution as running
  await prisma.workflowExecution.update({
    where: { id: workflowExecutionId },
    data: { status: 'running', startedAt: execution.status === 'pending' ? new Date() : undefined },
  })

  // We need the step definition — read from WorkflowTemplate.steps JSON
  // The step definition is stored in WorkflowTemplate; if no template, use inline inputData
  const stepDef = await resolveStepDefinition(workflowExecutionId, stepIndex)
  if (!stepDef) {
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'failed',
        errorMessage: `Cannot resolve step definition for index ${stepIndex}`,
        completedAt: new Date(),
      },
    })
    return
  }

  // Create StepExecution if it doesn't exist, or update retry count
  if (!stepExecution) {
    stepExecution = await prisma.stepExecution.create({
      data: {
        workflowExecutionId,
        stepIndex,
        stepName: stepDef.name,
        stepType: stepDef.type,
        status: 'running',
        startedAt: new Date(),
      },
    })
  } else {
    stepExecution = await prisma.stepExecution.update({
      where: { id: stepExecution.id },
      data: { status: 'running', retryCount: { increment: 1 }, startedAt: new Date() },
    })
  }

  // Build token-budgeted context
  const context = await buildStepContext(workflowExecutionId, stepIndex, stepDef)

  // Execute the step
  const result = await executeStep(stepDef, context)

  // Handle result
  await handleStepResult(workflowExecutionId, stepExecution.id, stepIndex, result)
}

/**
 * Store step result and evaluate the confidence gate.
 * If auto-approved: advance currentStepIndex and complete or enqueue next.
 * If approval required: pause execution at waiting_approval.
 * If failed: apply retry logic or surface to human.
 */
export async function handleStepResult(
  workflowExecutionId: string,
  stepExecutionId: string,
  stepIndex: number,
  result: StepResult
): Promise<void> {
  if (result.success) {
    const gate = evaluateGate(result)

    if (gate.decision === 'await_human') {
      // Pause for human approval
      await prisma.stepExecution.update({
        where: { id: stepExecutionId },
        data: {
          status: 'waiting_approval',
          outputData: result.output as never,
          confidenceScore: result.confidenceScore,
          completedAt: new Date(),
        },
      })
      await prisma.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: { status: 'waiting_approval' },
      })
    } else {
      // Auto-approved — mark step complete and advance
      await prisma.stepExecution.update({
        where: { id: stepExecutionId },
        data: {
          status: 'completed',
          outputData: result.output as never,
          confidenceScore: result.confidenceScore,
          autoApproved: true,
          completedAt: new Date(),
        },
      })
      await advanceToNextStep(workflowExecutionId, stepIndex)
    }
  } else {
    // Step failed
    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: 'failed',
        errorMessage: result.error,
        completedAt: new Date(),
      },
    })

    if (result.terminal) {
      // Terminal failure — no retry
      await prisma.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: 'failed',
          errorMessage: result.error,
          completedAt: new Date(),
        },
      })
    }
    // Non-terminal: orchestrator caller (BullMQ worker) handles re-enqueue with retryCount check
  }
}

/**
 * Approve the current waiting_approval step and advance the workflow.
 * Called by the approval API route.
 */
export async function approveCurrentStep(
  workflowExecutionId: string,
  approvedBy: string
): Promise<void> {
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: { currentStepIndex: true, status: true },
  })

  if (execution.status !== 'waiting_approval') {
    throw new Error(`Execution ${workflowExecutionId} is not waiting for approval (status: ${execution.status})`)
  }

  // Mark current step as approved
  await prisma.stepExecution.updateMany({
    where: {
      workflowExecutionId,
      stepIndex: execution.currentStepIndex,
      status: 'waiting_approval',
    },
    data: {
      status: 'completed',
      autoApproved: false,
      approvedBy,
      approvedAt: new Date(),
    },
  })

  // Advance to next step
  await advanceToNextStep(workflowExecutionId, execution.currentStepIndex)
}

/**
 * Cancel a workflow execution at the current step boundary.
 */
export async function cancelExecution(
  workflowExecutionId: string
): Promise<void> {
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: { status: true, currentStepIndex: true },
  })

  // Can only cancel non-terminal executions
  if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
    throw new Error(`Cannot cancel execution in terminal status: ${execution.status}`)
  }

  // Mark current running/waiting step as cancelled
  await prisma.stepExecution.updateMany({
    where: {
      workflowExecutionId,
      stepIndex: execution.currentStepIndex,
      status: { in: ['running', 'waiting_approval', 'pending'] },
    },
    data: { status: 'skipped', completedAt: new Date() },
  })

  await prisma.workflowExecution.update({
    where: { id: workflowExecutionId },
    data: { status: 'cancelled', completedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate the confidence gate for a successful step result.
 * Minions Principle 5: walls before models.
 */
function evaluateGate(result: StepResultSuccess): GateOutcome {
  // Explicit approval requirement always wins
  if (result.requiresApproval) {
    return { decision: 'await_human', reason: 'Step explicitly requires human approval' }
  }

  const confidence = result.confidenceScore
  if (confidence === undefined) {
    // No confidence score = auto-approve (deterministic action/validation steps)
    return { decision: 'auto_approve', reason: 'No confidence score — deterministic step' }
  }

  if (confidence >= DEFAULT_AUTO_APPROVE_THRESHOLD) {
    return { decision: 'auto_approve', reason: `Confidence ${confidence.toFixed(2)} >= threshold ${DEFAULT_AUTO_APPROVE_THRESHOLD}` }
  }

  return {
    decision: 'await_human',
    reason: `Confidence ${confidence.toFixed(2)} < threshold ${DEFAULT_AUTO_APPROVE_THRESHOLD}`,
  }
}

/**
 * Advance currentStepIndex and either complete the execution or mark it
 * ready for the next step (BullMQ enqueues the next advance).
 */
async function advanceToNextStep(workflowExecutionId: string, completedStepIndex: number): Promise<void> {
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: { totalSteps: true },
  })

  const nextStepIndex = completedStepIndex + 1

  if (nextStepIndex >= execution.totalSteps) {
    // All steps done
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'completed',
        currentStepIndex: nextStepIndex,
        completedAt: new Date(),
      },
    })
  } else {
    // More steps — advance index and return to running state
    // The BullMQ worker will call advanceWorkflow() again for the next step
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'running',
        currentStepIndex: nextStepIndex,
      },
    })
  }
}

/**
 * Resolve the step definition at a given index.
 * Reads from the WorkflowExecution's linked WorkflowTemplate, or from inputData.steps.
 */
async function resolveStepDefinition(
  workflowExecutionId: string,
  stepIndex: number
): Promise<WorkflowStepDefinition | null> {
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: { workflowId: true, inputData: true },
  })

  // If linked to a WorkflowTemplate, read steps from there
  if (execution.workflowId) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: execution.workflowId },
      select: { steps: true },
    })
    if (template?.steps) {
      const steps = template.steps as unknown as WorkflowStepDefinition[]
      return steps[stepIndex] ?? null
    }
  }

  // Fallback: steps stored in inputData.steps (ad-hoc workflow)
  if (execution.inputData && typeof execution.inputData === 'object') {
    const data = execution.inputData as { steps?: WorkflowStepDefinition[] }
    return data.steps?.[stepIndex] ?? null
  }

  return null
}
