/**
 * Context Builder — Phase 62
 * Assembles token-budgeted context for AI steps.
 *
 * Minions Principle 1: "Context > Model"
 * Each AI step receives exactly the relevant prior outputs — not full history.
 * Token budget prevents context drift and keeps AI costs predictable.
 */

import { prisma } from '@/lib/prisma'
import type { StepContext, PriorStepOutput, WorkflowStepDefinition, StepType } from './types'

/** Maximum number of prior step outputs to include in context (token budget) */
const MAX_PRIOR_STEPS = 3

/** Maximum characters per prior step output (truncate verbose outputs) */
const MAX_OUTPUT_CHARS = 2000

/**
 * Assembles context for an AI step from persisted execution state.
 *
 * Pattern (Minions-inspired):
 *   step definition + previous StepExecution.outputData (last N) → StepContext
 *
 * Does NOT include full conversation history — each step is isolated.
 */
export async function buildStepContext(
  workflowExecutionId: string,
  stepIndex: number,
  stepDefinition: WorkflowStepDefinition
): Promise<StepContext> {
  // Load the workflow execution for initial input, total steps, and org context
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: {
      inputData: true,
      totalSteps: true,
      organizationId: true,
    },
  })

  // Load prior step executions (completed only, most recent N steps)
  const priorStepExecutions = await prisma.stepExecution.findMany({
    where: {
      workflowExecutionId,
      stepIndex: { lt: stepIndex },
      status: 'completed',
    },
    orderBy: { stepIndex: 'asc' },
    select: {
      stepIndex: true,
      stepName: true,
      stepType: true,
      outputData: true,
      confidenceScore: true,
    },
  })

  // Apply token budget: take only the last MAX_PRIOR_STEPS
  const budgetedSteps = priorStepExecutions.slice(-MAX_PRIOR_STEPS)

  // Map to PriorStepOutput, truncating verbose outputs
  // SECURITY: Exclude credential-inject steps from priorOutputs to prevent
  // decrypted credentials from leaking into AI prompts
  const priorOutputs: PriorStepOutput[] = budgetedSteps
    .filter((step) => step.stepType !== 'credential-inject')
    .map((step) => {
      let output: unknown = step.outputData
      // Truncate if string output exceeds budget
      if (typeof output === 'string' && output.length > MAX_OUTPUT_CHARS) {
        output = output.slice(0, MAX_OUTPUT_CHARS) + '... [truncated for token budget]'
      }
      return {
        stepIndex: step.stepIndex,
        stepName: step.stepName,
        stepType: step.stepType as StepType,
        output,
        confidenceScore: step.confidenceScore ?? undefined,
      }
    })

  return {
    stepDefinition,
    priorOutputs,
    workflowInput: execution.inputData,
    stepIndex,
    totalSteps: execution.totalSteps,
    organizationId: execution.organizationId,
  }
}
