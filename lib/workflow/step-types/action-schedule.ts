import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  try {
    const lastOutput = context.priorOutputs[context.priorOutputs.length - 1];
    const config = stepDef.config as { scheduledAt?: string } | undefined;
    const scheduledAt = config?.scheduledAt
      ? new Date(config.scheduledAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const organizationId = context.organizationId;
    if (!organizationId) {
      return {
        success: false,
        error: 'action-schedule: trusted organisation required',
        terminal: true,
      };
    }
    const input = context.workflowInput as { campaignId?: string } | undefined;

    // Campaign ownership comes only from the trusted execution organisation.
    const campaignId = input?.campaignId;
    let campaign;
    if (campaignId) {
      campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, organizationId },
      });
    } else {
      campaign = await prisma.campaign.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!campaign || campaign.organizationId !== organizationId) {
      return {
        success: false,
        error: 'action-schedule: no campaign found for organisation',
        terminal: true,
      };
    }

    const contentData = lastOutput?.output as { content?: string } | undefined;
    const post = await prisma.post.create({
      data: {
        content:
          contentData?.content ?? JSON.stringify(lastOutput?.output ?? {}),
        platform:
          (stepDef.config as { platform?: string } | undefined)?.platform ??
          'multi',
        status: 'scheduled',
        scheduledAt,
        campaignId: campaign.id,
      },
    });
    return {
      success: true,
      output: {
        scheduledPostId: post.id,
        scheduledAt: scheduledAt.toISOString(),
      },
      confidenceScore: 1.0,
    };
  } catch (err) {
    logger.error('action-schedule step failed', {
      error: err,
      stepName: stepDef.name,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Schedule action failed',
      terminal: false,
    };
  }
}
