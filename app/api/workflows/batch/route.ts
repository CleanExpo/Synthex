/**
 * Workflow Batch API — POST (start batch) + GET (list batches)
 * Phase 63: Parallel Agent Execution
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { subscriptionService } from '@/lib/stripe/subscription-service'
import { executeParallel, MAX_BATCH_SIZE } from '@/lib/workflow/parallel-executor'

export const runtime = 'nodejs'

const ALLOWED_PLANS = ['professional', 'business', 'custom']

const stepDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ai', 'approval', 'action', 'validation']),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
})

const batchByIdsSchema = z.object({
  workflowIds: z.array(z.string().cuid()).min(1).max(MAX_BATCH_SIZE),
})

const batchByTemplateSchema = z.object({
  templateId: z.string().cuid(),
  count: z.number().int().min(1).max(MAX_BATCH_SIZE),
  inputs: z.array(z.record(z.unknown())).optional(),
  title: z.string().min(1).optional(),
})

const batchByStepsSchema = z.object({
  executions: z
    .array(
      z.object({
        title: z.string().min(1),
        steps: z.array(stepDefSchema).min(1),
        inputData: z.record(z.unknown()).optional(),
        workflowId: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_BATCH_SIZE),
})

const startBatchSchema = z.union([batchByIdsSchema, batchByTemplateSchema, batchByStepsSchema])

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function POST(request: NextRequest) {
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

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = startBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Handle batch-by-workflow-ids: re-execute existing templates
  if ('workflowIds' in parsed.data) {
    const { workflowIds } = parsed.data
    const templates = await prisma.workflowTemplate.findMany({
      where: { id: { in: workflowIds }, organizationId: orgId },
      select: { id: true, name: true, steps: true },
    })
    if (templates.length === 0) {
      return NextResponse.json({ error: 'No templates found for provided IDs' }, { status: 404 })
    }

    const inputs = templates.map((t) => ({
      title: t.name,
      steps: (t.steps as unknown as import('@/lib/workflow/types').WorkflowStepDefinition[]),
      workflowId: t.id,
    }))

    const settled = await executeParallel(inputs, orgId, userId, batchId)
    const executions = await prisma.workflowExecution.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ batchId, executions, settled }, { status: 201 })
  }

  // Handle batch-by-template: create N executions from a single template
  if ('templateId' in parsed.data) {
    const { templateId, count, inputs, title } = parsed.data
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
      select: { id: true, name: true, steps: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const execInputs = Array.from({ length: count }, (_, i) => ({
      title: title ?? `${template.name} — Variant ${i + 1}`,
      steps: (template.steps as unknown as import('@/lib/workflow/types').WorkflowStepDefinition[]),
      inputData: inputs?.[i] ?? {},
      workflowId: template.id,
    }))

    const settled = await executeParallel(execInputs, orgId, userId, batchId)
    const executions = await prisma.workflowExecution.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ batchId, executions, settled }, { status: 201 })
  }

  // Handle batch-by-steps: arbitrary executions with inline step definitions
  if ('executions' in parsed.data) {
    const { executions } = parsed.data
    const settled = await executeParallel(executions, orgId, userId, batchId)
    const dbExecutions = await prisma.workflowExecution.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ batchId, executions: dbExecutions, settled }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
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

  // List unique batches for this org
  const batches = await prisma.workflowExecution.groupBy({
    by: ['batchId'],
    where: { organizationId: orgId, batchId: { not: null } },
    _count: { batchId: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 20,
  })

  return NextResponse.json({ batches })
}
