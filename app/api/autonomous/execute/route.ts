/**
 * POST /api/autonomous/execute — Creates workflow execution + enqueues
 *
 * Takes the parsed instruction output and creates a real WorkflowExecution.
 * Requires authenticated session + Professional+ plan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue';

export const runtime = 'nodejs';

const ALLOWED_PLANS = ['professional', 'business', 'custom'];

const stepDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ai', 'approval', 'action', 'validation']),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
});

const executeSchema = z.object({
  title: z.string().min(1).max(100),
  steps: z.array(stepDefSchema).min(1).max(10),
  inputData: z.record(z.string(), z.unknown()).optional(),
});

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const subscription = await subscriptionService.getSubscription(userId);
  if (!subscription || !ALLOWED_PLANS.includes(subscription.plan)) {
    return NextResponse.json(
      {
        error: 'This feature requires a Professional or Business plan.',
        upgrade: true,
      },
      { status: 403 }
    );
  }

  const orgId = await getOrgId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = executeSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: validated.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { title, steps, inputData } = validated.data;

  const execution = await prisma.workflowExecution.create({
    data: {
      organizationId: orgId,
      title,
      status: 'pending',
      currentStepIndex: 0,
      totalSteps: steps.length,
      triggerType: 'manual',
      triggeredBy: userId,
      inputData: {
        steps,
        sourceType: 'autonomous',
        ...(inputData ?? {}),
      } as object,
    },
  });

  // Enqueue step 0
  try {
    await enqueueWorkflowStep(execution.id, 0, 0);
  } catch {
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

  return NextResponse.json(
    {
      execution: {
        id: execution.id,
        title: execution.title,
        status: execution.status,
        totalSteps: execution.totalSteps,
        createdAt: execution.createdAt,
      },
    },
    { status: 201 }
  );
}
