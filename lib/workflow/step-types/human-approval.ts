/**
 * Human Approval Step — Phase 62 + Phase 64 update
 *
 * Phase 62 behaviour: always pause for human review (requiresApproval = true).
 * Phase 64 update: if content is available in context AND QualityScorer can score it,
 * attach the quality score to the output so the review queue panel can display it.
 * Still always requires human approval — QualityScorer only INFORMS, never auto-approves
 * from this step type (auto-approve logic stays in the orchestrator confidence gate).
 */
import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'
import { getQualityScorer } from '@/lib/brand-voice/quality-scorer'

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  // Try to extract content from the most recent prior output (ai-generate step)
  const lastAiOutput = context.priorOutputs
    .slice()
    .reverse()
    .find((p) => p.stepType === 'ai')

  const content =
    lastAiOutput && typeof lastAiOutput.output === 'object' && lastAiOutput.output !== null
      ? (lastAiOutput.output as { content?: string }).content
      : undefined

  let qualityScore: import('@/lib/brand-voice/quality-scorer').QualityScore | undefined

  if (content && process.env.OPENROUTER_API_KEY) {
    try {
      const scorer = getQualityScorer()
      qualityScore = await scorer.scoreContent(content)
      logger.info('human-approval: quality score computed', {
        overall: qualityScore.overall,
        autoApprove: qualityScore.autoApprove,
      })
    } catch (err) {
      logger.warn('human-approval: quality scoring failed, proceeding without score', { error: err })
    }
  }

  return {
    success: true,
    output: {
      waitingFor: 'human_approval',
      ...(qualityScore ? { qualityScore } : {}),
      ...(content ? { contentPreview: content.slice(0, 500) } : {}),
    },
    requiresApproval: true,
    confidenceScore: qualityScore?.overall,
  }
}
