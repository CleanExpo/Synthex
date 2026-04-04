/**
 * Brand Voice Review — Reject a step execution
 * Phase 64: AI Quality & Brand Voice Guardian
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'

export const runtime = 'nodejs'

const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
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

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const step = await prisma.stepExecution.findFirst({
    where: {
      id: stepId,
      status: 'waiting_approval',
      workflowExecution: { organizationId: orgId },
    },
    select: { id: true, workflowExecutionId: true },
  })

  if (!step) {
    return NextResponse.json({ error: 'Step not found or not awaiting approval' }, { status: 404 })
  }

  // Mark step failed with rejection reason
  await prisma.stepExecution.update({
    where: { id: step.id },
    data: {
      status: 'failed',
      errorMessage: `Rejected by reviewer: ${parsed.data.reason}`,
      completedAt: new Date(),
    },
  })

  // Mark workflow as failed — rejection is terminal
  await prisma.workflowExecution.update({
    where: { id: step.workflowExecutionId },
    data: {
      status: 'failed',
      errorMessage: `Step rejected: ${parsed.data.reason}`,
      completedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, stepId: step.id })
}
