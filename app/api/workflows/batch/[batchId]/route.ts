/**
 * Workflow Batch Status API — GET status of a specific batch
 * Phase 63: Parallel Agent Execution
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { subscriptionService } from '@/lib/stripe/subscription-service'
import { getBatchStatus } from '@/lib/workflow/parallel-executor'

export const runtime = 'nodejs'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userId = security.context.userId
  const subscription = await subscriptionService.getSubscription(userId)
  if (!subscription || !ALLOWED_PLANS.includes(subscription.plan)) {
    return NextResponse.json(
      { error: 'This feature requires a Professional or Business plan.', upgrade: true },
      { status: 403 }
    )
  }
  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  const { batchId } = await params
  const batchStatus = await getBatchStatus(batchId, orgId)

  if (batchStatus.total === 0) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  return NextResponse.json(batchStatus)
}
