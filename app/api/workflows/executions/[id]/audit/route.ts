/**
 * GET /api/workflows/executions/[id]/audit — SYN-972 (Audit leg).
 *
 * Returns the human-readable decision timeline for a workflow execution: who
 * approved/rejected each step, when, and why. Read-only and org-scoped — a
 * caller only sees their own org's executions. Secret-free (no credentials are
 * read; only step status/decision metadata).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { buildWorkflowAuditTrail } from '@/lib/workflow/audit-trail';

export const runtime = 'nodejs';

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const orgId = await getOrgId(security.context.userId);
  if (!orgId)
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );

  const { id } = await params;

  // Org-scoped ownership check.
  const execution = await prisma.workflowExecution.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, title: true, status: true },
  });
  if (!execution)
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });

  const steps = await prisma.stepExecution.findMany({
    where: { workflowExecutionId: id },
    orderBy: { stepIndex: 'asc' },
    select: {
      stepIndex: true,
      stepName: true,
      stepType: true,
      status: true,
      autoApproved: true,
      approvedBy: true,
      approvedAt: true,
      errorMessage: true,
      outputData: true,
      completedAt: true,
    },
  });

  return NextResponse.json({
    execution,
    trail: buildWorkflowAuditTrail(steps),
  });
}
