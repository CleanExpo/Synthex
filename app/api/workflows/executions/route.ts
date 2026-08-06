/**
 * Workflow Executions API — GET (list) + POST (create + enqueue)
 *
 * AT-028: `template: 'content-campaign'` expands to contentCampaignWorkflow
 * (planner → generator → evaluator → brand-voice → strategist → approval → publish)
 * so the workflows surface can start a real campaign run without ad-hoc step arrays.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue';
import type { WorkflowStepDefinition } from '@/lib/workflow/types';
import { contentCampaignWorkflow } from '@/lib/workflow/workflow-templates';
import { requireEntitlement } from '@/lib/billing/require-entitlement';

export const runtime = 'nodejs';

const STEP_TYPES = [
  'ai',
  'ai-plan',
  'ai-evaluate',
  'approval',
  'action',
  'validation',
  'credential-inject',
] as const;

const stepDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(STEP_TYPES),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
});

const createExecutionSchema = z
  .object({
    title: z.string().min(1),
    steps: z.array(stepDefSchema).min(1).optional(),
    inputData: z.record(z.string(), z.unknown()).optional(),
    triggerType: z
      .enum(['manual', 'scheduled', 'webhook'])
      .optional()
      .default('manual'),
    /** DB WorkflowTemplate id (UI sends templateId; workflowId kept for compat). */
    workflowId: z.string().optional(),
    templateId: z.string().optional(),
    /** Builtin AT-028 content campaign harness. */
    template: z.enum(['content-campaign']).optional(),
    autoPublish: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const hasSteps = Boolean(data.steps?.length);
    const hasBuiltin = data.template === 'content-campaign';
    const hasDbTemplate = Boolean(data.templateId || data.workflowId);
    if (!hasSteps && !hasBuiltin && !hasDbTemplate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide steps, template: "content-campaign", or templateId/workflowId',
        path: ['steps'],
      });
    }
  });

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

function asStepDefinitions(raw: unknown): WorkflowStepDefinition[] {
  const parsed = z.array(stepDefSchema).min(1).safeParse(raw);
  if (!parsed.success) {
    throw new Error('Stored template steps are invalid');
  }
  return parsed.data as WorkflowStepDefinition[];
}

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  const userId = security.context.userId;
  // Subscription gate — Professional plan or higher (status-aware, fails closed).
  const entitlement = await requireEntitlement(userId, 'workflows');
  if (!entitlement.allowed) {
    return NextResponse.json(
      {
        error: 'This feature requires a Professional or Business plan.',
        upgrade: true,
      },
      { status: 403 }
    );
  }
  const orgId = await getOrgId(userId);
  if (!orgId)
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
  const cursor = searchParams.get('cursor') ?? undefined;

  const executions = await prisma.workflowExecution.findMany({
    where: { organizationId: orgId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = executions.length > limit;
  const data = hasMore ? executions.slice(0, limit) : executions;
  return NextResponse.json({
    executions: data,
    nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
  });
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  const userId = security.context.userId;
  // Subscription gate — Professional plan or higher (status-aware, fails closed).
  const entitlement = await requireEntitlement(userId, 'workflows');
  if (!entitlement.allowed) {
    return NextResponse.json(
      {
        error: 'This feature requires a Professional or Business plan.',
        upgrade: true,
      },
      { status: 403 }
    );
  }
  const orgId = await getOrgId(userId);
  if (!orgId)
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createExecutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const {
    title,
    steps: bodySteps,
    inputData,
    triggerType,
    workflowId,
    templateId,
    template,
    autoPublish,
  } = parsed.data;

  let steps: WorkflowStepDefinition[];
  let resolvedWorkflowId = workflowId ?? templateId;
  let agencyTaskId: string | undefined;

  try {
    if (template === 'content-campaign') {
      const def = contentCampaignWorkflow({ autoPublish });
      steps = def.steps;
      agencyTaskId = 'AT-028';
    } else if (bodySteps?.length) {
      steps = bodySteps as WorkflowStepDefinition[];
    } else if (resolvedWorkflowId) {
      const dbTemplate = await prisma.workflowTemplate.findFirst({
        where: {
          id: resolvedWorkflowId,
          organizationId: orgId,
          isActive: true,
        },
      });
      if (!dbTemplate) {
        return NextResponse.json(
          { error: 'Workflow template not found' },
          { status: 404 }
        );
      }
      steps = asStepDefinitions(dbTemplate.steps);
      resolvedWorkflowId = dbTemplate.id;
    } else {
      return NextResponse.json(
        { error: 'Validation failed', details: { steps: ['Required'] } },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid workflow template steps' },
      { status: 400 }
    );
  }

  const execution = await prisma.workflowExecution.create({
    data: {
      organizationId: orgId,
      title,
      status: 'pending',
      currentStepIndex: 0,
      totalSteps: steps.length,
      triggerType,
      triggeredBy: userId,
      inputData: {
        steps,
        ...(inputData ?? {}),
        ...(agencyTaskId
          ? {
              agencyTaskId,
              sourceType: 'content-campaign',
              workflowInput:
                (inputData as { workflowInput?: unknown } | undefined)
                  ?.workflowInput ?? inputData,
            }
          : {}),
      } as object,
      ...(resolvedWorkflowId ? { workflowId: resolvedWorkflowId } : {}),
    },
  });

  // Enqueue step 0 — Redis may be unavailable in some environments
  try {
    await enqueueWorkflowStep(execution.id, 0, 0);
  } catch (queueError) {
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        errorMessage: 'Queue unavailable — ensure REDIS_URL is configured',
      },
    });
    return NextResponse.json(
      {
        error: 'Workflow queue unavailable',
        details: 'REDIS_URL not configured',
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ execution }, { status: 201 });
}
