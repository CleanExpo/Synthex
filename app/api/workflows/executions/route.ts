/**
 * Workflow Executions API — GET (list) + POST (create + enqueue)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue'
import type { WorkflowStepDefinition } from '@/lib/workflow/types'

export const runtime = 'nodejs'

const stepDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ai', 'approval', 'action', 'validation']),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
})

const createExecutionSchema = z.object({
  title: z.string().min(1),
  steps: z.array(stepDefSchema).min(1),
  inputData: z.record(z.unknown()).optional(),
  triggerType: z.enum(['manual', 'scheduled', 'webhook']).optional().default('manual'),
  workflowId: z.string().optional(),
})

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const orgId = await getOrgId(security.context.userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const cursor = searchParams.get('cursor') ?? undefined

  const executions = await prisma.workflowExecution.findMany({
    where: { organizationId: orgId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = executions.length > limit
  const data = hasMore ? executions.slice(0, limit) : executions
  return NextResponse.json({ executions: data, nextCursor: hasMore ? data[data.length - 1]?.id : undefined })
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const orgId = await getOrgId(security.context.userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = createExecutionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { title, steps, inputData, triggerType, workflowId } = parsed.data

  const execution = await prisma.workflowExecution.create({
    data: {
      organizationId: orgId,
      title,
      status: 'pending',
      currentStepIndex: 0,
      totalSteps: steps.length,
      triggerType,
      inputData: { steps, ...(inputData ?? {}) } as object,
      ...(workflowId ? { workflowId } : {}),
    },
  })

  // Enqueue step 0
  await enqueueWorkflowStep(execution.id, 0, 0)

  return NextResponse.json({ execution }, { status: 201 })
}
