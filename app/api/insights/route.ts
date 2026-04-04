/**
 * Insights API — GET latest AI-surfaced opportunities for the org
 * Phase 66: Autonomous Insights Agent
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { subscriptionService } from '@/lib/stripe/subscription-service'

export const runtime = 'nodejs'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20)

  // Fetch cron-triggered workflow executions = insights agent runs
  const executions = await prisma.workflowExecution.findMany({
    where: {
      organizationId: orgId,
      triggerType: 'cron',
      title: 'AI Insights Agent Run',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      outputData: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      stepExecutions: {
        where: { status: 'waiting_approval' },
        select: {
          id: true,
          stepName: true,
          outputData: true,
          confidenceScore: true,
          createdAt: true,
        },
      },
    },
  })

  // Derive the last run time from the most recent execution
  const lastRun = executions[0]?.startedAt ?? null

  return NextResponse.json({ insights: executions, lastRun })
}
