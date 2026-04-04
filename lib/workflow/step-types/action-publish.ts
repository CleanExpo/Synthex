import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, context: StepContext): Promise<StepResult> {
  // Human approval gate is ALWAYS enforced before this step by the orchestrator
  // This step just records intent — actual publishing is handled by the scheduler
  try {
    const lastOutput = context.priorOutputs[context.priorOutputs.length - 1]
    const config = stepDef.config as { platform?: string } | undefined
    logger.info('action-publish: recording publish intent', { stepName: stepDef.name, platform: config?.platform })
    return {
      success: true,
      output: {
        platformPostId: `pending-${Date.now()}`,
        publishedAt: new Date().toISOString(),
        platform: config?.platform ?? 'unknown',
        content: lastOutput?.output,
        status: 'queued_for_publish',
      },
      confidenceScore: 1.0,
    }
  } catch (err) {
    logger.error('action-publish step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'Publish action failed', terminal: false }
  }
}
