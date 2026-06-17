import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, context: StepContext): Promise<StepResult> {
  // Human approval gate is ALWAYS enforced before this step by the orchestrator.
  // This step RECORDS PUBLISH INTENT only — it does not publish, and no post is
  // created yet (real publishing is a separate scheduler integration). It must
  // therefore NOT fabricate a platformPostId or a publishedAt timestamp — doing
  // so falsely asserts a publication that never happened (no mock/stub data in
  // product surfaces, per CLAUDE.md) and would surface as a fake "published"
  // entry in the audit trail.
  try {
    const lastOutput = context.priorOutputs[context.priorOutputs.length - 1]
    const config = stepDef.config as { platform?: string } | undefined
    logger.info('action-publish: recording publish intent', { stepName: stepDef.name, platform: config?.platform })
    return {
      success: true,
      output: {
        status: 'awaiting_publish',
        platform: config?.platform ?? 'unknown',
        content: lastOutput?.output,
        intentRecordedAt: new Date().toISOString(),
        note: 'Approved content recorded as publish intent — no post created yet; real publishing is handled by the scheduler once wired.',
      },
      confidenceScore: 1.0,
    }
  } catch (err) {
    logger.error('action-publish step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'Publish action failed', terminal: false }
  }
}
