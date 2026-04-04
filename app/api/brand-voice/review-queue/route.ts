/**
 * Brand Voice Review Queue API — GET pending items for human review
 * Phase 64: AI Quality & Brand Voice Guardian
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'

export const runtime = 'nodejs'

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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  // Fetch step executions awaiting human review across all org executions
  // Filter to AI-type steps (ai-generate, ai-analyse, ai-enrich) — the ones that produce content
  const queueItems = await prisma.stepExecution.findMany({
    where: {
      status: 'waiting_approval',
      stepType: { in: ['ai', 'ai-generate', 'ai-analyse', 'ai-enrich'] },
      workflowExecution: { organizationId: orgId },
    },
    include: {
      workflowExecution: {
        select: {
          id: true,
          title: true,
          organizationId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  return NextResponse.json({ items: queueItems, total: queueItems.length })
}
