import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { subscriptionService } from '@/lib/stripe/subscription-service'
import { cancelExecution } from '@/lib/workflow/orchestrator'

export const runtime = 'nodejs'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

const cancelSchema = z.object({ reason: z.string().max(500).optional() })

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

  const execution = await prisma.workflowExecution.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, status: true },
  })
  if (!execution) return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
  if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
    return NextResponse.json({ error: `Cannot cancel execution in terminal status: ${execution.status}` }, { status: 409 })
  }

  let body: unknown = {}
  try { body = await request.json() } catch { /* optional */ }
  cancelSchema.safeParse(body) // Validate but reason is informational only

  try {
    await cancelExecution(id)
    const updated = await prisma.workflowExecution.findUnique({ where: { id } })
    return NextResponse.json({ execution: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to cancel execution' }, { status: 500 })
  }
}
