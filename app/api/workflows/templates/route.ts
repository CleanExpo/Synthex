import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'

export const runtime = 'nodejs'

const stepDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ai', 'approval', 'action', 'validation']),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  steps: z.array(stepDefSchema).min(1),
  autoApproveThreshold: z.number().min(0).max(1).optional().default(0.85),
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

  const templates = await prisma.workflowTemplate.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ templates })
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

  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { name, description, steps, autoApproveThreshold } = parsed.data

  const template = await prisma.workflowTemplate.create({
    data: {
      organizationId: orgId,
      name,
      description,
      steps: steps as object,
      autoApproveThreshold: autoApproveThreshold ?? 0.85,
      isActive: true,
      createdBy: security.context.userId,
    },
  })
  return NextResponse.json({ template }, { status: 201 })
}
