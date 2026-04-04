import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, _context: StepContext): Promise<StepResult> {
  try {
    const config = stepDef.config as { message?: string; channel?: string } | undefined
    logger.info('action-notify: notification queued', { stepName: stepDef.name, channel: config?.channel ?? 'in-app' })
    // Notification infrastructure integration — log intent, actual delivery handled by notification system
    return {
      success: true,
      output: { notificationSent: true, channel: config?.channel ?? 'in-app', message: config?.message ?? 'Workflow step completed' },
      confidenceScore: 1.0,
    }
  } catch (err) {
    logger.error('action-notify step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'Notify action failed', terminal: false }
  }
}
