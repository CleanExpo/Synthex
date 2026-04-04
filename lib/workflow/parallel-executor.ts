/**
 * Parallel Executor — Phase 63
 *
 * Manages parallel workflow execution across multiple WorkflowExecution records.
 * Uses Promise.allSettled (never Promise.all) so partial failures do not abort the batch.
 * Each execution is fully independent — no shared step state.
 *
 * Architecture (Minions principle: "walls before models"):
 * - Max concurrency enforced via WORKFLOW_CONCURRENCY env var (default 5)
 * - Each execution reads its own StepExecution chain
 * - Settled results include both fulfilled and rejected outcomes
 */

import { prisma } from '@/lib/prisma'
import { enqueueWorkflowBatch } from '@/lib/queue/bull-queue'
import { logger } from '@/lib/logger'
import type { WorkflowStepDefinition } from './types'

/** Max concurrent workflow executions (configurable via env) */
const MAX_CONCURRENCY = parseInt(process.env.WORKFLOW_CONCURRENCY ?? '5', 10)

/** Max batch size per request */
export const MAX_BATCH_SIZE = 10

export interface ParallelExecutionInput {
  /** Title for each execution (indexed with batch position if single title) */
  title: string
  /** Step definitions for this execution */
  steps: WorkflowStepDefinition[]
  /** Input data payload */
  inputData?: Record<string, unknown>
  /** Linked WorkflowTemplate id (optional) */
  workflowId?: string
}

export interface SettledResult {
  id: string
  status: 'fulfilled' | 'rejected'
  executionId?: string
  reason?: string
}

/**
 * Create and enqueue N workflow executions in parallel.
 * Returns a settled results array — failed creates do not abort the batch.
 */
export async function executeParallel(
  inputs: ParallelExecutionInput[],
  organisationId: string,
  triggeredBy: string,
  batchId: string
): Promise<SettledResult[]> {
  if (inputs.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size ${inputs.length} exceeds maximum of ${MAX_BATCH_SIZE}`)
  }
  if (inputs.length > MAX_CONCURRENCY) {
    logger.warn('parallel-executor: batch size exceeds concurrency limit', {
      batchSize: inputs.length,
      maxConcurrency: MAX_CONCURRENCY,
    })
  }

  logger.info('parallel-executor: starting batch', { batchId, count: inputs.length })

  // Create all executions in parallel — settled so partial failure is ok
  const createResults = await Promise.allSettled(
    inputs.map((input, index) =>
      prisma.workflowExecution.create({
        data: {
          organizationId: organisationId,
          title: `${input.title} [${index + 1}/${inputs.length}]`,
          status: 'pending',
          currentStepIndex: 0,
          totalSteps: input.steps.length,
          triggerType: 'api',
          triggeredBy,
          inputData: { steps: input.steps, ...(input.inputData ?? {}) } as object,
          batchId,
          ...(input.workflowId ? { workflowId: input.workflowId } : {}),
        },
      })
    )
  )

  // Collect successfully created execution ids
  const successfulIds: string[] = []
  const settled: SettledResult[] = createResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      successfulIds.push(result.value.id)
      return { id: `batch-item-${index}`, status: 'fulfilled' as const, executionId: result.value.id }
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      logger.error('parallel-executor: failed to create execution', { index, reason })
      return { id: `batch-item-${index}`, status: 'rejected' as const, reason }
    }
  })

  // Enqueue all successful executions in one batch call
  if (successfulIds.length > 0) {
    try {
      await enqueueWorkflowBatch(batchId, successfulIds)
      logger.info('parallel-executor: batch enqueued', { batchId, enqueued: successfulIds.length })
    } catch (err) {
      logger.error('parallel-executor: failed to enqueue batch', { batchId, error: err })
      // Enqueue failure is non-fatal — executions are created in DB, worker will pick them up on retry
    }
  }

  return settled
}

/**
 * Get aggregated status for a batch of executions.
 */
export async function getBatchStatus(batchId: string, organisationId: string) {
  const executions = await prisma.workflowExecution.findMany({
    where: { batchId, organizationId: organisationId },
    select: {
      id: true,
      title: true,
      status: true,
      currentStepIndex: true,
      totalSteps: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const statusCounts = executions.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  const total = executions.length
  const completed = statusCounts['completed'] ?? 0
  const failed = statusCounts['failed'] ?? 0
  const running = statusCounts['running'] ?? 0
  const pending = statusCounts['pending'] ?? 0
  const cancelled = statusCounts['cancelled'] ?? 0
  const waitingApproval = statusCounts['waiting_approval'] ?? 0

  const aggregate =
    total === 0 ? 'empty'
    : completed + failed + cancelled === total ? 'settled'
    : running > 0 ? 'running'
    : waitingApproval > 0 ? 'waiting_approval'
    : 'pending'

  return {
    batchId,
    aggregate,
    total,
    counts: statusCounts,
    executions,
  }
}
