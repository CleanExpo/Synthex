/**
 * Workflow Intelligence API
 * Phase 65: Campaign Intelligence Engine
 *
 * GET  /api/workflows/intelligence?templateId=X — performance analysis
 * POST /api/workflows/intelligence/apply — apply suggested prompt improvement
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { extractPatterns, optimizePrompt } from '@/lib/workflow/intelligence'

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
  const templateId = searchParams.get('templateId')

  if (!templateId) {
    return NextResponse.json({ error: 'templateId query parameter is required' }, { status: 400 })
  }

  // Extract patterns from StepExecution history
  const analysis = await extractPatterns(templateId, orgId)

  // For low-performing steps, fetch sample outputs and generate improvement suggestions
  // Only do this if there are low-performing steps and OpenRouter is configured
  if (analysis.lowPerformingCount > 0 && process.env.OPENROUTER_API_KEY) {
    const lowPerformingSteps = analysis.patterns.filter((p) => p.isLowPerforming)

    const optimisationPromises = lowPerformingSteps.slice(0, 3).map(async (pattern) => {
      // Get sample outputs for low-confidence executions at this step
      const executions = await prisma.workflowExecution.findMany({
        where: { workflowId: templateId, organizationId: orgId },
        select: { id: true },
        take: 20,
      })
      const executionIds = executions.map((e) => e.id)

      const lowSteps = await prisma.stepExecution.findMany({
        where: {
          workflowExecutionId: { in: executionIds },
          stepIndex: pattern.stepIndex,
          status: 'completed',
          confidenceScore: { lt: 0.75 },
        },
        select: { outputData: true },
        take: 3,
      })

      const highSteps = await prisma.stepExecution.findMany({
        where: {
          workflowExecutionId: { in: executionIds },
          stepIndex: pattern.stepIndex,
          status: 'completed',
          confidenceScore: { gte: 0.85 },
        },
        select: { outputData: true },
        take: 3,
      })

      const extractContent = (output: unknown): string => {
        if (!output || typeof output !== 'object') return ''
        const o = output as { content?: string }
        return o.content ?? JSON.stringify(output).slice(0, 500)
      }

      const lowSamples = lowSteps.map((s) => extractContent(s.outputData))
      const highSamples = highSteps.map((s) => extractContent(s.outputData))

      try {
        const suggestion = await optimizePrompt(pattern.promptTemplatePreview, lowSamples, highSamples)
        pattern.improvementSuggestion = suggestion.suggestedPrompt
        return { stepIndex: pattern.stepIndex, suggestion }
      } catch {
        return null
      }
    })

    await Promise.allSettled(optimisationPromises)
  }

  return NextResponse.json({ analysis })
}

const applySchema = z.object({
  templateId: z.string().cuid(),
  stepIndex: z.number().int().min(0),
  newPrompt: z.string().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const orgId = await getOrgId(security.context.userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { templateId, stepIndex, newPrompt } = parsed.data

  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, organizationId: orgId },
    select: { id: true, steps: true },
  })

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const steps = template.steps as Array<Record<string, unknown>>

  if (stepIndex >= steps.length) {
    return NextResponse.json({ error: `Step index ${stepIndex} out of range (template has ${steps.length} steps)` }, { status: 400 })
  }

  // Update the specific step's promptTemplate
  steps[stepIndex] = { ...steps[stepIndex], promptTemplate: newPrompt }

  await prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { steps: steps as never },
  })

  return NextResponse.json({ success: true, templateId, stepIndex, updatedPrompt: newPrompt })
}
