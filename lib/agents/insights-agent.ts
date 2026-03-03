/**
 * Autonomous Insights Agent — Phase 66
 *
 * Scheduled AI agent that proactively surfaces content opportunities.
 * Invoked from Vercel cron every 4 hours.
 *
 * Architecture (Minions "minion invoked from cron"):
 * - Circuit breaker: max 1 run per hour, max 6 per day (stored in WorkflowExecution records)
 * - Analyses last 7 days of PlatformMetrics + recent SocialMentions
 * - Generates top 3 content opportunities with draft content
 * - High confidence (≥ 0.85): auto-draft as Campaign + Post (pending, never published)
 * - Low confidence: WorkflowExecution with status waiting_approval
 * - Creates a WorkflowExecution audit record for every run
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const AUTO_DRAFT_THRESHOLD = 0.85
const CIRCUIT_BREAKER_MIN_INTERVAL_MS = 60 * 60 * 1000   // 1 hour
const CIRCUIT_BREAKER_DAILY_MAX = 6

export interface ContentOpportunity {
  title: string
  description: string
  confidenceScore: number
  suggestedPlatforms: string[]
  urgency: 'low' | 'medium' | 'high'
}

export interface InsightsDraft {
  content: string
  platform: string
  opportunityTitle: string
  confidenceScore: number
}

export interface InsightsResult {
  opportunities: ContentOpportunity[]
  generatedDrafts: InsightsDraft[]
  autoDraftedCount: number
  queuedForReviewCount: number
  executionId: string
  circuitBreakerTripped: boolean
}

/**
 * Run the autonomous insights agent for an organisation.
 * Returns InsightsResult — never throws (errors are logged, empty result returned).
 */
export async function runInsightsAgent(
  orgId: string,
  triggeredBy: string = 'cron'
): Promise<InsightsResult> {
  const empty: InsightsResult = {
    opportunities: [],
    generatedDrafts: [],
    autoDraftedCount: 0,
    queuedForReviewCount: 0,
    executionId: '',
    circuitBreakerTripped: false,
  }

  try {
    // Circuit breaker check
    const circuitBreakerResult = await checkCircuitBreaker(orgId)
    if (circuitBreakerResult.tripped) {
      logger.warn('insights-agent: circuit breaker active', { orgId, reason: circuitBreakerResult.reason })
      return { ...empty, circuitBreakerTripped: true }
    }

    // Create audit WorkflowExecution record
    const execution = await prisma.workflowExecution.create({
      data: {
        organizationId: orgId,
        title: 'AI Insights Agent Run',
        status: 'running',
        triggerType: 'cron',
        triggeredBy,
        currentStepIndex: 0,
        totalSteps: 3,
        startedAt: new Date(),
      },
    })

    // Step 1: Gather performance data
    const performanceData = await gatherPerformanceData(orgId)

    // Step 2: Generate opportunities via OpenRouter
    const opportunities = await generateOpportunities(performanceData, orgId)

    // Step 3: Generate draft content for each opportunity
    const drafts = await generateDrafts(opportunities)

    // Process results: high confidence → auto-draft; low confidence → queue for review
    let autoDraftedCount = 0
    let queuedForReviewCount = 0

    // Get the org's first user to use as campaign userId (agent acts on behalf of org)
    const orgUser = await prisma.user.findFirst({
      where: { organizationId: orgId },
      select: { id: true },
    })

    if (orgUser) {
      for (const draft of drafts) {
        if (draft.confidenceScore >= AUTO_DRAFT_THRESHOLD) {
          await createAutoDraft(draft, orgId, orgUser.id)
          autoDraftedCount++
        } else {
          await createReviewQueueItem(draft, execution.id, orgId, orgUser.id)
          queuedForReviewCount++
        }
      }
    }

    // Mark execution complete
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'completed',
        currentStepIndex: 3,
        completedAt: new Date(),
        outputData: {
          opportunities: opportunities.length,
          drafts: drafts.length,
          autoDrafted: autoDraftedCount,
          queued: queuedForReviewCount,
        } as never,
      },
    })

    logger.info('insights-agent: run complete', {
      orgId,
      executionId: execution.id,
      opportunities: opportunities.length,
      autoDrafted: autoDraftedCount,
      queued: queuedForReviewCount,
    })

    return {
      opportunities,
      generatedDrafts: drafts,
      autoDraftedCount,
      queuedForReviewCount,
      executionId: execution.id,
      circuitBreakerTripped: false,
    }
  } catch (err) {
    logger.error('insights-agent: run failed', { orgId, error: err })
    return empty
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

async function checkCircuitBreaker(orgId: string): Promise<{ tripped: boolean; reason: string }> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - CIRCUIT_BREAKER_MIN_INTERVAL_MS)
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Check for run in the last hour
  const recentRun = await prisma.workflowExecution.findFirst({
    where: {
      organizationId: orgId,
      triggerType: 'cron',
      title: 'AI Insights Agent Run',
      startedAt: { gte: oneHourAgo },
    },
    select: { id: true, startedAt: true },
  })

  if (recentRun) {
    return { tripped: true, reason: 'Ran within the last hour' }
  }

  // Check daily cap
  const todayCount = await prisma.workflowExecution.count({
    where: {
      organizationId: orgId,
      triggerType: 'cron',
      title: 'AI Insights Agent Run',
      startedAt: { gte: midnightToday },
    },
  })

  if (todayCount >= CIRCUIT_BREAKER_DAILY_MAX) {
    return { tripped: true, reason: `Daily limit of ${CIRCUIT_BREAKER_DAILY_MAX} runs reached` }
  }

  return { tripped: false, reason: '' }
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

interface PerformanceData {
  topPerformingPlatforms: string[]
  avgEngagementRate: number
  recentMentionTopics: string[]
  postCount7d: number
}

async function gatherPerformanceData(orgId: string): Promise<PerformanceData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Get org users to look up their connections
  const orgUsers = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true },
    take: 10,
  })
  const userIds = orgUsers.map((u) => u.id)

  // Get platform connections for org users
  const connections = await prisma.platformConnection.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { id: true, platform: true },
    take: 20,
  })
  const connectionIds = connections.map((c) => c.id)
  const platforms = [...new Set(connections.map((c) => c.platform))]

  // Get recent platform metrics
  let avgEngagementRate = 0
  if (connectionIds.length > 0) {
    const metrics = await prisma.platformMetrics.findMany({
      where: {
        post: { connectionId: { in: connectionIds } },
        recordedAt: { gte: sevenDaysAgo },
      },
      select: { engagementRate: true },
      take: 100,
    })
    const rates = metrics.map((m) => m.engagementRate).filter((r): r is number => r !== null)
    avgEngagementRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }

  // Get recent social mentions
  const mentions = await prisma.socialMention.findMany({
    where: {
      userId: { in: userIds },
      createdAt: { gte: sevenDaysAgo },
    },
    select: { content: true, sentiment: true },
    take: 20,
  })

  const mentionTopics = mentions
    .slice(0, 5)
    .map((m) => {
      const words = (m.content ?? '').split(' ').slice(0, 5).join(' ')
      return words
    })
    .filter(Boolean)

  // Count recent posts
  const postCount7d = await prisma.post.count({
    where: {
      campaign: { organizationId: orgId },
      createdAt: { gte: sevenDaysAgo },
    },
  })

  return {
    topPerformingPlatforms: platforms.slice(0, 3),
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    recentMentionTopics: mentionTopics,
    postCount7d,
  }
}

// ---------------------------------------------------------------------------
// Opportunity generation
// ---------------------------------------------------------------------------

async function generateOpportunities(
  data: PerformanceData,
  _orgId: string
): Promise<ContentOpportunity[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Return sample opportunities when no API key configured
    return [
      {
        title: 'Engagement Boost Opportunity',
        description: 'Recent engagement data suggests short-form video content would perform well.',
        confidenceScore: 0.78,
        suggestedPlatforms: data.topPerformingPlatforms.slice(0, 2),
        urgency: 'medium',
      },
    ]
  }

  const systemPrompt = `You are a content strategy AI for a marketing platform.
Return ONLY valid JSON matching this schema:
{
  "opportunities": [
    {
      "title": "<opportunity title>",
      "description": "<1-2 sentence description>",
      "confidenceScore": <0.0 to 1.0>,
      "suggestedPlatforms": ["<platform>"],
      "urgency": "low" | "medium" | "high"
    }
  ]
}

Identify exactly 3 content opportunities based on the data. Be specific and actionable.`

  const userPrompt = `Performance data for the last 7 days:
- Active platforms: ${data.topPerformingPlatforms.join(', ') || 'none yet'}
- Average engagement rate: ${data.avgEngagementRate.toFixed(2)}%
- Posts published: ${data.postCount7d}
- Recent mention topics: ${data.recentMentionTopics.join('; ') || 'none detected'}

Identify the top 3 content opportunities.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
        'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.5,
      }),
    })

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)

    const responseData = await res.json()
    const raw = responseData.choices?.[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in opportunities response')

    const parsed = JSON.parse(jsonMatch[0]) as {
      opportunities?: ContentOpportunity[]
    }

    return (parsed.opportunities ?? []).slice(0, 3)
  } catch (err) {
    logger.error('insights-agent: opportunity generation failed', { error: err })
    return []
  }
}

// ---------------------------------------------------------------------------
// Draft content generation
// ---------------------------------------------------------------------------

async function generateDrafts(opportunities: ContentOpportunity[]): Promise<InsightsDraft[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || opportunities.length === 0) return []

  const drafts: InsightsDraft[] = []

  for (const opp of opportunities) {
    const platform = opp.suggestedPlatforms[0] ?? 'general'
    const prompt = `Write a compelling ${platform} post for this content opportunity:
Title: ${opp.title}
Description: ${opp.description}

Requirements:
- Platform: ${platform}
- Tone: professional but engaging
- Include relevant hashtags
- Keep it under 280 characters for Twitter, longer for LinkedIn/Instagram
- Do not include any preamble, just the post content itself`

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          temperature: 0.7,
        }),
      })

      if (!res.ok) continue

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''

      if (content) {
        drafts.push({
          content,
          platform,
          opportunityTitle: opp.title,
          confidenceScore: opp.confidenceScore,
        })
      }
    } catch (err) {
      logger.warn('insights-agent: draft generation failed for opportunity', {
        title: opp.title,
        error: err,
      })
    }
  }

  return drafts
}

// ---------------------------------------------------------------------------
// Auto-draft + review queue helpers
// ---------------------------------------------------------------------------

async function createAutoDraft(
  draft: InsightsDraft,
  orgId: string,
  userId: string
): Promise<void> {
  const campaign = await prisma.campaign.create({
    data: {
      name: `AI Insight: ${draft.opportunityTitle}`,
      description: `Auto-drafted by AI Insights Agent — ${new Date().toLocaleDateString('en-AU')}`,
      platform: draft.platform,
      status: 'draft',
      userId,
      organizationId: orgId,
      content: { aiGenerated: true, opportunityTitle: draft.opportunityTitle } as never,
    },
  })

  await prisma.post.create({
    data: {
      content: draft.content,
      platform: draft.platform,
      status: 'draft', // Never published automatically
      campaignId: campaign.id,
      metadata: {
        aiGenerated: true,
        insightsAgent: true,
        confidenceScore: draft.confidenceScore,
      } as never,
    },
  })
}

async function createReviewQueueItem(
  draft: InsightsDraft,
  executionId: string,
  _orgId: string,
  _userId: string
): Promise<void> {
  // Create a step execution record in the insights workflow execution
  await prisma.stepExecution.create({
    data: {
      workflowExecutionId: executionId,
      stepIndex: 0,
      stepName: `Review: ${draft.opportunityTitle}`,
      stepType: 'ai',
      status: 'waiting_approval',
      outputData: {
        content: draft.content,
        platform: draft.platform,
        opportunityTitle: draft.opportunityTitle,
      } as never,
      confidenceScore: draft.confidenceScore,
      startedAt: new Date(),
    },
  })
}
