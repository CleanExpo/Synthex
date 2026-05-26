/**
 * Spawn a content workflow when an advisor brief action is marked done (SYN-972).
 * Uses the standard content-campaign template with advisor context in inputData.
 */

import prisma from '@/lib/prisma';
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue';
import { contentCampaignWorkflow } from '@/lib/workflow/workflow-templates';
import { logger } from '@/lib/logger';

export interface AdvisorActionInput {
  rank: number;
  title: string;
  rationale: string;
  effort: string;
  expectedImpact: string;
  actionUrl?: string;
}

export class AdvisorWorkflowSpawnError extends Error {
  constructor(
    message: string,
    readonly code: 'QUEUE_UNAVAILABLE' | 'CREATE_FAILED'
  ) {
    super(message);
    this.name = 'AdvisorWorkflowSpawnError';
  }
}

export async function spawnAdvisorActionWorkflow(params: {
  organizationId: string;
  userId: string;
  briefId: string;
  action: AdvisorActionInput;
}): Promise<{ executionId: string }> {
  const def = contentCampaignWorkflow({ autoPublish: false });
  const title = `Advisor: ${params.action.title}`.slice(0, 100);

  let execution;
  try {
    execution = await prisma.workflowExecution.create({
      data: {
        organizationId: params.organizationId,
        title,
        status: 'pending',
        currentStepIndex: 0,
        totalSteps: def.steps.length,
        triggerType: 'manual',
        triggeredBy: params.userId,
        inputData: {
          steps: def.steps,
          sourceType: 'advisor',
          advisorBriefId: params.briefId,
          advisorAction: params.action,
          workflowInput: {
            goal: params.action.title,
            rationale: params.action.rationale,
            expectedImpact: params.action.expectedImpact,
            effort: params.action.effort,
            rank: params.action.rank,
          },
        } as object,
      },
    });
  } catch (err) {
    logger.error('advisor: workflow execution create failed', {
      briefId: params.briefId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AdvisorWorkflowSpawnError(
      'Failed to create workflow execution',
      'CREATE_FAILED'
    );
  }

  try {
    await enqueueWorkflowStep(execution.id, 0, 0);
  } catch (err) {
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        errorMessage: 'Queue unavailable — ensure REDIS_URL is configured',
      },
    });
    logger.warn('advisor: workflow queue unavailable', {
      executionId: execution.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AdvisorWorkflowSpawnError(
      'Workflow queue unavailable',
      'QUEUE_UNAVAILABLE'
    );
  }

  logger.info('advisor: workflow spawned from brief action', {
    briefId: params.briefId,
    executionId: execution.id,
    actionRank: params.action.rank,
  });

  return { executionId: execution.id };
}
