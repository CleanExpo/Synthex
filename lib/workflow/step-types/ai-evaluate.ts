/**
 * ai-evaluate step type — UNI-1650
 *
 * Evaluator stage of the Planner→Generator→Evaluator harness.
 * Reads generated content + brief from priorOutputs and returns
 * a structured EvaluationResult. The confidenceScore feeds directly
 * into the orchestrator's approval gate (threshold: 0.85).
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import {
  evaluateContent,
  type EvaluationResult,
} from '@/lib/ai/content-evaluator';
import type { ContentBrief } from '@/lib/ai/content-planner';
import type { AiPlanOutput } from './ai-plan';
import { logger } from '@/lib/logger';

export interface AiEvaluateOutput {
  evaluation: EvaluationResult;
}

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  try {
    const { content, brief } = resolveEvaluatorInputs(context);

    logger.info('ai-evaluate step: starting', {
      stepIndex: context.stepIndex,
      contentLength: content.length,
      goal: brief.goal,
    });

    const evaluation = await evaluateContent(content, brief);

    logger.info('ai-evaluate step: complete', {
      score: evaluation.score,
      pass: evaluation.pass,
      dimensions: evaluation.dimensions,
    });

    return {
      success: true,
      output: { evaluation } satisfies AiEvaluateOutput,
      confidenceScore: evaluation.confidenceScore,
      // If the evaluator says fail, require human review regardless of threshold
      requiresApproval: !evaluation.pass,
    };
  } catch (err) {
    logger.error('ai-evaluate step failed', {
      error: err,
      stepName: stepDef.name,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Evaluation step failed',
      terminal: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Resolve evaluator inputs from prior step outputs
// ---------------------------------------------------------------------------

interface EvaluatorInputs {
  content: string;
  brief: ContentBrief;
}

function resolveEvaluatorInputs(context: StepContext): EvaluatorInputs {
  let content = '';
  let brief: ContentBrief | null = null;

  for (const prior of context.priorOutputs) {
    // Find brief from ai-plan step
    if (prior.stepType === 'ai-plan') {
      const output = prior.output as AiPlanOutput | null;
      if (output?.brief) brief = output.brief;
    }

    // Find generated content from ai (generate) step
    if (prior.stepType === 'ai') {
      const output = prior.output as { content?: string } | null;
      if (output?.content && output.content.length > content.length) {
        content = output.content;
      }
    }
  }

  if (!content) {
    throw new Error('ai-evaluate: no generated content found in prior outputs');
  }

  if (!brief) {
    // Synthesise a minimal brief from workflow input so evaluation can proceed
    const raw = context.workflowInput;
    const goal =
      typeof raw === 'string'
        ? raw
        : ((raw as { goal?: string } | null)?.goal ?? 'Unknown goal');
    brief = {
      goal,
      targetAudience: 'General audience',
      contentPillars: [],
      tone: 'professional',
      platformConstraints: {},
      keyMessages: [],
      contentRequests: [],
    };
    logger.warn(
      'ai-evaluate: no ContentBrief found in prior outputs — using minimal fallback brief'
    );
  }

  return { content, brief };
}
