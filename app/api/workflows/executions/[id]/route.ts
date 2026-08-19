import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { requireEntitlement } from '@/lib/billing/require-entitlement';

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

  const execution = await prisma.workflowExecution.findFirst({
    where: { id, organizationId: orgId },
    include: { stepExecutions: { orderBy: { stepIndex: 'asc' } } },
  });
  if (!execution)
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  return NextResponse.json({ execution });
}
