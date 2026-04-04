import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { subscriptionService } from '@/lib/stripe/subscription-service'
import { approveCurrentStep } from '@/lib/workflow/orchestrator'

export const runtime = 'nodejs'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

const approveSchema = z.object({ comment: z.string().max(2000).optional() })

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
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

  const { id } = await params

  // Verify ownership
  const execution = await prisma.workflowExecution.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, status: true },
  })
  if (!execution) return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
  if (execution.status !== 'waiting_approval') {
    return NextResponse.json({ error: `Execution is not waiting for approval (status: ${execution.status})` }, { status: 409 })
  }

  let body: unknown = {}
  try { body = await request.json() } catch { /* body is optional */ }
  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    await approveCurrentStep(id, userId)
    const updated = await prisma.stepExecution.findFirst({
      where: { workflowExecutionId: id },
      orderBy: { stepIndex: 'desc' },
    })
    return NextResponse.json({ stepExecution: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to approve step' }, { status: 500 })
  }
}
