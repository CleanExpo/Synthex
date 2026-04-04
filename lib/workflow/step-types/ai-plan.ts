/**
 * ai-plan step type — UNI-1650
 *
 * Planner stage of the Planner→Generator→Evaluator harness.
 * Reads workflowInput as a campaign goal and produces a ContentBrief artifact
 * that subsequent steps (ai-generate, ai-evaluate) can read from priorOutputs.
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import {
  planContent,
  type PlannerInput,
  type ContentBrief,
} from '@/lib/ai/content-planner';
import { logger } from '@/lib/logger';

export interface AiPlanOutput {
  brief: ContentBrief;
}

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  try {
    const input = resolvePlannerInput(context);

    logger.info('ai-plan step: starting', {
      goal: input.goal,
      stepIndex: context.stepIndex,
    });

    const brief = await planContent(input);

    logger.info('ai-plan step: brief produced', {
      pillars: brief.contentPillars.length,
      contentRequests: brief.contentRequests.length,
    });

    return {
      success: true,
      output: { brief } satisfies AiPlanOutput,
      // Planning is deterministic given the input — high confidence
      confidenceScore: 1.0,
    };
  } catch (err) {
    logger.error('ai-plan step failed', { error: err, stepName: stepDef.name });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Planning step failed',
      terminal: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Resolve PlannerInput from workflow context
// ---------------------------------------------------------------------------

function resolvePlannerInput(context: StepContext): PlannerInput {
  const raw = context.workflowInput;

  // Accept: plain string goal
  if (typeof raw === 'string') {
    return { goal: raw };
  }

  // Accept: object with goal field
  if (raw && typeof raw === 'object' && 'goal' in raw) {
    const typed = raw as {
      goal: string;
      platform?: string;
      orgContext?: PlannerInput['orgContext'];
    };
    return {
      goal: typed.goal,
      platform: typed.platform,
      orgContext: typed.orgContext,
    };
  }

  // Fallback: stringify whatever we got
  return { goal: JSON.stringify(raw) };
}
