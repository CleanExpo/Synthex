/**
 * Brand Voice Review — Approve a step execution
 * Phase 64: AI Quality & Brand Voice Guardian
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { advanceToNextStepAfterApproval } from '@/lib/workflow/review-helpers'

export const runtime = 'nodejs'

const approveSchema = z.object({
  feedback: z.string().max(2000).optional(),
})

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const orgId = await getOrgId(security.context.userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  const { stepId } = await params

  let body: unknown = {}
  try { body = await request.json() } catch { /* body is optional */ }

  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const step = await prisma.stepExecution.findFirst({
    where: {
      id: stepId,
      status: 'waiting_approval',
      workflowExecution: { organizationId: orgId },
    },
    select: { id: true, workflowExecutionId: true, stepIndex: true },
  })

  if (!step) {
    return NextResponse.json({ error: 'Step not found or not awaiting approval' }, { status: 404 })
  }

  // Mark step approved
  await prisma.stepExecution.update({
    where: { id: step.id },
    data: {
      status: 'completed',
      autoApproved: false,
      approvedBy: security.context.userId,
      approvedAt: new Date(),
      ...(parsed.data.feedback ? { outputData: { feedback: parsed.data.feedback } as never } : {}),
    },
  })

  // Advance the workflow
  await advanceToNextStepAfterApproval(step.workflowExecutionId, step.stepIndex)

  return NextResponse.json({ success: true, stepId: step.id })
}
