/**
 * Workflow Step Worker — Phase 62
 * Processes workflow:execute-step BullMQ jobs.
 * Calls orchestrator.advanceWorkflow() for each job.
 * On success: orchestrator handles next step enqueueing internally.
 * On failure: re-enqueue with incremented retryCount (up to MAX_RETRIES=2).
 */
import { Worker, Job } from 'bullmq'
import { QUEUE_NAMES, WorkflowStepJobData, enqueueWorkflowStep } from '../bull-queue'
import { advanceWorkflow } from '@/lib/workflow/orchestrator'
import { logger } from '@/lib/logger'

const MAX_RETRIES = 2

export function createWorkflowStepWorker(): Worker {
  const worker = new Worker<WorkflowStepJobData>(
    QUEUE_NAMES.WORKFLOW_STEPS,
    async (job: Job<WorkflowStepJobData>) => {
      const { workflowExecutionId, stepIndex, retryCount } = job.data
      logger.info('workflow-step-worker: processing', { workflowExecutionId, stepIndex, retryCount })
      try {
        await advanceWorkflow(workflowExecutionId)
        logger.info('workflow-step-worker: step complete', { workflowExecutionId, stepIndex })
      } catch (err) {
        logger.error('workflow-step-worker: step failed', { error: err, workflowExecutionId, stepIndex, retryCount })
        if (retryCount < MAX_RETRIES) {
          await enqueueWorkflowStep(workflowExecutionId, stepIndex, retryCount + 1)
          logger.info('workflow-step-worker: re-enqueued', { workflowExecutionId, stepIndex, nextRetry: retryCount + 1 })
        } else {
          logger.error('workflow-step-worker: max retries exceeded, orchestrator will surface to human', { workflowExecutionId, stepIndex })
        }
        // Don't throw — orchestrator handles terminal state
      }
    },
    {
      connection: { host: 'localhost', port: 6379 }, // Will be overridden by REDIS_URL in production
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    logger.error('workflow-step-worker: job failed', { jobId: job?.id, error: err })
  })

  return worker
}
