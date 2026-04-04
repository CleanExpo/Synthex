/**
 * Pattern Extractor — Phase 65
 *
 * Analyses historical StepExecution records to identify prompt performance patterns.
 * Groups executions by stepIndex and prompt template, calculates avg confidence scores,
 * and flags low-performing steps for optimisation.
 *
 * Architecture (Minions: "context > model"):
 * - Improves context assembly and prompt templates, not the underlying AI model
 * - Uses real StepExecution history — no mock data
 * - Improvement suggestions come from AI analysing its own outputs
 * - NEVER auto-applies suggestions — returns recommendations for human approval
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

const LOW_CONFIDENCE_THRESHOLD = 0.75

export interface PromptPattern {
  stepIndex: number
  stepName: string
  stepType: string
  promptTemplateHash: string
  promptTemplatePreview: string // First 200 chars
  avgConfidenceScore: number
  minConfidenceScore: number
  maxConfidenceScore: number
  sampleCount: number
  isLowPerforming: boolean // avgConfidence < LOW_CONFIDENCE_THRESHOLD
  improvementSuggestion?: string // Populated by prompt-optimizer if available
}

export interface PatternAnalysis {
  templateId: string
  orgId: string
  analysedAt: string
  totalExecutions: number
  patterns: PromptPattern[]
  overallAvgConfidence: number
  lowPerformingCount: number
}

/**
 * Extract performance patterns from StepExecution history for a workflow template.
 * Queries last 50 completed step executions for each step index.
 */
export async function extractPatterns(
  templateId: string,
  orgId: string
): Promise<PatternAnalysis> {
  logger.info('pattern-extractor: analysing template', { templateId, orgId })

  // Load template to get step definitions
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, organizationId: orgId },
    select: { id: true, steps: true },
  })

  if (!template) {
    throw new Error(`Template ${templateId} not found for org ${orgId}`)
  }

  const steps = template.steps as Array<{
    name?: string
    type?: string
    promptTemplate?: string
  }>

  // Get all completed executions linked to this template
  const executions = await prisma.workflowExecution.findMany({
    where: {
      workflowId: templateId,
      organizationId: orgId,
      status: { in: ['completed', 'failed'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  if (executions.length === 0) {
    return {
      templateId,
      orgId,
      analysedAt: new Date().toISOString(),
      totalExecutions: 0,
      patterns: [],
      overallAvgConfidence: 0,
      lowPerformingCount: 0,
    }
  }

  const executionIds = executions.map((e) => e.id)

  // Fetch step executions for all linked executions
  const stepExecutions = await prisma.stepExecution.findMany({
    where: {
      workflowExecutionId: { in: executionIds },
      status: 'completed',
      confidenceScore: { not: null },
    },
    select: {
      stepIndex: true,
      stepName: true,
      stepType: true,
      confidenceScore: true,
      inputData: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // Group by stepIndex
  const groupedByStep = new Map<number, typeof stepExecutions>()
  for (const se of stepExecutions) {
    const group = groupedByStep.get(se.stepIndex) ?? []
    group.push(se)
    groupedByStep.set(se.stepIndex, group)
  }

  const patterns: PromptPattern[] = []
  let totalConfidenceSum = 0
  let totalConfidenceCount = 0

  for (const [stepIndex, stepGroup] of groupedByStep.entries()) {
    // Limit to last 50 samples per step
    const samples = stepGroup.slice(0, 50)
    const scores = samples
      .map((s) => s.confidenceScore)
      .filter((s): s is number => s !== null)

    if (scores.length === 0) continue

    const avgConfidence = scores.reduce((a, b) => a + b, 0) / scores.length
    const minConfidence = Math.min(...scores)
    const maxConfidence = Math.max(...scores)

    totalConfidenceSum += avgConfidence
    totalConfidenceCount++

    // Get prompt template from step definition
    const stepDef = steps[stepIndex]
    const promptTemplate = stepDef?.promptTemplate ?? ''
    const promptHash = promptTemplate
      ? crypto.createHash('md5').update(promptTemplate).digest('hex').slice(0, 8)
      : 'no-prompt'

    patterns.push({
      stepIndex,
      stepName: stepGroup[0].stepName,
      stepType: stepGroup[0].stepType,
      promptTemplateHash: promptHash,
      promptTemplatePreview: promptTemplate.slice(0, 200),
      avgConfidenceScore: Math.round(avgConfidence * 100) / 100,
      minConfidenceScore: Math.round(minConfidence * 100) / 100,
      maxConfidenceScore: Math.round(maxConfidence * 100) / 100,
      sampleCount: scores.length,
      isLowPerforming: avgConfidence < LOW_CONFIDENCE_THRESHOLD,
    })
  }

  patterns.sort((a, b) => a.stepIndex - b.stepIndex)

  const overallAvgConfidence =
    totalConfidenceCount > 0
      ? Math.round((totalConfidenceSum / totalConfidenceCount) * 100) / 100
      : 0

  return {
    templateId,
    orgId,
    analysedAt: new Date().toISOString(),
    totalExecutions: executions.length,
    patterns,
    overallAvgConfidence,
    lowPerformingCount: patterns.filter((p) => p.isLowPerforming).length,
  }
}
