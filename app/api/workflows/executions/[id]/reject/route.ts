/**
 * POST /api/workflows/executions/[id]/reject — SYN-972
 *
 * The reject / request-revision Gate decision for the CEO batched-review queue.
 * Holds a `waiting_approval` workflow as `revision_requested` with the reviewer's
 * reason — nothing publishes — so the content can be revised and re-triggered.
 * Mirrors the approve route (auth + Professional gate + org-ownership).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { rejectCurrentStep } from '@/lib/workflow/orchestrator';
import { requireEntitlement } from '@/lib/billing/require-entitlement';

export const runtime = 'nodejs';

const rejectSchema = z.object({ reason: z.string().min(1).max(2000) });

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Subscription gate — Professional plan or higher (status-aware, fails
  // closed on a missing or unpaid/past-due subscription).
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

  const { id } = await params;

  // Verify ownership + gate state.
  const execution = await prisma.workflowExecution.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, status: true },
  });
  if (!execution)
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  if (execution.status !== 'waiting_approval') {
    return NextResponse.json(
      {
        error: `Execution is not waiting for approval (status: ${execution.status})`,
      },
      { status: 409 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* fall through to validation */
  }
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    await rejectCurrentStep(id, userId, parsed.data.reason);
    const updated = await prisma.workflowExecution.findUnique({
      where: { id },
      select: { id: true, status: true, errorMessage: true },
    });
    return NextResponse.json({ execution: updated });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reject step' },
      { status: 500 }
    );
  }
}
