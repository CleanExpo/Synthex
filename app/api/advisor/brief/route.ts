/**
 * GET  /api/advisor/brief  — Fetch the latest delivered advisor brief for this org
 * PATCH /api/advisor/brief  — Mark an action as done; optionally spawn workflow (SYN-972)
 *
 * @task SYN-595, SYN-972
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import {
  spawnAdvisorActionWorkflow,
  AdvisorWorkflowSpawnError,
  type AdvisorActionInput,
} from '@/lib/advisor/spawn-workflow-from-action';

const PatchSchema = z.object({
  actionIndex: z.number().int().min(0).max(2),
  /** When true (default), start content-campaign workflow for this action */
  startWorkflow: z.boolean().optional().default(true),
});

async function resolveOrg(
  request: NextRequest
): Promise<{ organizationId: string; userId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Resolve the active brand for multi-business owners (falls back to the
  // user's home organisation, then null) rather than the home org directly —
  // otherwise a brand-switched owner reads/mutates the WRONG brand's advisor
  // brief (and spawns a workflow against it). See lib/multi-business.
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  return { organizationId, userId };
}

function parseAdvisorAction(
  raw: Record<string, unknown>
): AdvisorActionInput | null {
  if (typeof raw.title !== 'string' || typeof raw.rationale !== 'string') {
    return null;
  }
  return {
    rank: typeof raw.rank === 'number' ? raw.rank : 0,
    title: raw.title,
    rationale: raw.rationale,
    effort: typeof raw.effort === 'string' ? raw.effort : 'medium',
    expectedImpact:
      typeof raw.expectedImpact === 'string' ? raw.expectedImpact : '',
    actionUrl: typeof raw.actionUrl === 'string' ? raw.actionUrl : undefined,
  };
}

export async function GET(request: NextRequest) {
  const orgResult = await resolveOrg(request);
  if (orgResult instanceof NextResponse) return orgResult;
  const { organizationId } = orgResult;

  const brief = await prisma.recommendedAction.findFirst({
    where: { organizationId, status: 'delivered' },
    orderBy: { weekStart: 'desc' },
  });

  if (!brief) {
    return NextResponse.json({ brief: null });
  }

  return NextResponse.json({ brief });
}

export async function PATCH(request: NextRequest) {
  const orgResult = await resolveOrg(request);
  if (orgResult instanceof NextResponse) return orgResult;
  const { organizationId, userId } = orgResult;

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { actionIndex, startWorkflow } = parsed.data;

  const brief = await prisma.recommendedAction.findFirst({
    where: { organizationId, status: 'delivered' },
    orderBy: { weekStart: 'desc' },
  });

  if (!brief) {
    return NextResponse.json({ error: 'No brief found' }, { status: 404 });
  }

  const actions = brief.actions as Array<Record<string, unknown>>;
  if (!Array.isArray(actions) || actionIndex >= actions.length) {
    return NextResponse.json(
      { error: 'Invalid action index' },
      { status: 400 }
    );
  }

  const rawAction = actions[actionIndex];
  let workflowExecutionId: string | undefined;
  let workflowWarning: string | undefined;

  if (startWorkflow) {
    const actionInput = parseAdvisorAction(rawAction);
    if (!actionInput) {
      // A stored action without a string title/rationale cannot be spawned.
      // Without this the caller asked for a workflow, got none, and the
      // response was indistinguishable from never having asked.
      workflowWarning =
        'Action is missing a title or rationale, so no workflow could be started.';
      logger.warn('advisor/brief: action not spawnable', {
        orgId: organizationId,
        briefId: brief.id,
        actionIndex,
      });
    }
    if (actionInput) {
      try {
        const spawned = await spawnAdvisorActionWorkflow({
          organizationId,
          userId,
          briefId: brief.id,
          action: actionInput,
        });
        workflowExecutionId = spawned.executionId;
      } catch (err) {
        if (err instanceof AdvisorWorkflowSpawnError) {
          workflowWarning = err.message;
          logger.warn('advisor/brief: workflow spawn skipped', {
            orgId: organizationId,
            briefId: brief.id,
            code: err.code,
          });
        } else {
          throw err;
        }
      }
    }
  }

  const completedAt = new Date().toISOString();
  const updated = actions.map((action, i) => {
    if (i !== actionIndex) return action;
    const next: Record<string, unknown> = {
      ...action,
      completed_at: completedAt,
    };
    if (workflowExecutionId) {
      next.workflow_execution_id = workflowExecutionId;
    }
    return next;
  });

  const result = await prisma.recommendedAction.update({
    where: { id: brief.id },
    data: { actions: updated as unknown as Prisma.InputJsonValue },
  });

  logger.info('advisor/brief: action marked done', {
    orgId: organizationId,
    briefId: brief.id,
    actionIndex,
    workflowExecutionId: workflowExecutionId ?? null,
  });

  return NextResponse.json({
    brief: result,
    workflowExecutionId: workflowExecutionId ?? null,
    workflowWarning: workflowWarning ?? null,
  });
}
