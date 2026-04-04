/**
 * Workflow Review Helpers — Phase 64
 * Shared utilities for approval/rejection flows in both the main approval route
 * and the brand-voice review queue routes.
 */

import { prisma } from '@/lib/prisma'
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue'

/**
 * After a step is manually approved (via brand-voice or main approval route),
 * advance the workflow's currentStepIndex and either mark complete or enqueue next step.
 */
export async function advanceToNextStepAfterApproval(
  workflowExecutionId: string,
  approvedStepIndex: number
): Promise<void> {
  const execution = await prisma.workflowExecution.findUniqueOrThrow({
    where: { id: workflowExecutionId },
    select: { totalSteps: true },
  })

  const nextStepIndex = approvedStepIndex + 1

  if (nextStepIndex >= execution.totalSteps) {
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'completed',
        currentStepIndex: nextStepIndex,
        completedAt: new Date(),
      },
    })
  } else {
    await prisma.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: 'running',
        currentStepIndex: nextStepIndex,
      },
    })
    // Re-enqueue so the BullMQ worker picks up the next step
    await enqueueWorkflowStep(workflowExecutionId, nextStepIndex, 0)
  }
}
