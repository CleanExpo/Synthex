/**
 * AI Insights Cron Endpoint — Phase 66
 *
 * GET /api/cron/insights
 * Called by Vercel cron scheduler every 4 hours.
 * Runs the AutonomousInsightsAgent for all active organisations.
 *
 * Auth: CRON_SECRET header (no Supabase session — cron has no browser context)
 *
 * Circuit breaker (in agent): max 1 run per hour, max 6 per day per org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runInsightsAgent } from '@/lib/agents/insights-agent'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  logger.info('cron/insights: starting run')

  try {
    // Find active organisations (has at least 1 user who logged in within the last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const activeOrgs = await prisma.organization.findMany({
      where: {
        users: {
          some: {
            lastLogin: { gte: thirtyDaysAgo },
          },
        },
      },
      select: { id: true, name: true },
      take: 50, // Safety cap
    })

    logger.info('cron/insights: found active orgs', { count: activeOrgs.length })

    let processed = 0
    let totalOpportunities = 0
    let totalDrafts = 0
    let totalQueued = 0
    let circuitBreakersTripped = 0

    // Process each org — allSettled for partial success
    const results = await Promise.allSettled(
      activeOrgs.map(async (org) => {
        const result = await runInsightsAgent(org.id, 'cron')
        return { orgId: org.id, ...result }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++
        if (result.value.circuitBreakerTripped) {
          circuitBreakersTripped++
        } else {
          totalOpportunities += result.value.opportunities.length
          totalDrafts += result.value.autoDraftedCount
          totalQueued += result.value.queuedForReviewCount
        }
      }
    }

    const duration = Date.now() - startTime
    logger.info('cron/insights: complete', {
      processed,
      totalOpportunities,
      totalDrafts,
      totalQueued,
      circuitBreakersTripped,
      durationMs: duration,
    })

    return NextResponse.json({
      success: true,
      processed,
      opportunities: totalOpportunities,
      drafts: totalDrafts,
      queued: totalQueued,
      circuitBreakersTripped,
      durationMs: duration,
    })
  } catch (err) {
    logger.error('cron/insights: run failed', { error: err })
    return NextResponse.json(
      { error: 'Cron run failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/insights
 * Development-only: trigger a manual run for the authenticated org.
 * Disabled in production (NODE_ENV check).
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Manual trigger not available in production' }, { status: 403 })
  }

  // Validate cron secret or dev environment
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get orgId from body or use first org
  let orgId: string | undefined
  try {
    const body = await request.json() as { orgId?: string }
    orgId = body.orgId
  } catch { /* ignore */ }

  if (!orgId) {
    const firstOrg = await prisma.organization.findFirst({ select: { id: true } })
    orgId = firstOrg?.id
  }

  if (!orgId) {
    return NextResponse.json({ error: 'No organisations found' }, { status: 404 })
  }

  const result = await runInsightsAgent(orgId, 'manual')
  return NextResponse.json({ result })
}
