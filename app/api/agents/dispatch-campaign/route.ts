/**
 * POST /api/agents/dispatch-campaign
 *
 * Triggers the Social Media Orchestrator to enhance all posts in a campaign
 * across their target platforms.
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId (multi-business aware)
 * Access control: campaign must belong to the authenticated user's org
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils'
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { logger } from '@/lib/logger'
import { SocialMediaOrchestrator } from '@/lib/agents/social-media-orchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// VALIDATION
// ============================================================================

const dispatchCampaignSchema = z.object({
  campaignId: z.string().min(1),
})

// ============================================================================
// POST /api/agents/dispatch-campaign
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Security check
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Auth
  const userId = await getUserIdFromRequestOrCookies(request)
  if (!userId) return unauthorizedResponse()

  // Org scoping
  const orgId = await getEffectiveOrganizationId(userId)
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation context found' }, { status: 403 })
  }

  // Parse body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = dispatchCampaignSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { campaignId } = parsed.data

  try {
    // Verify campaign belongs to this org before dispatch
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId },
      select: { id: true, name: true },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      )
    }

    logger.info('[dispatch-campaign] Starting campaign enhancement', {
      campaignId,
      orgId,
      campaignName: campaign.name,
    })

    // Run the orchestrator
    const orchestrator = new SocialMediaOrchestrator()
    const result = await orchestrator.enhanceCampaign(campaignId, orgId)

    const message =
      result.enhanced > 0
        ? `Successfully enhanced ${result.enhanced} post${result.enhanced !== 1 ? 's' : ''} across platforms.${result.skipped > 0 ? ` ${result.skipped} skipped (low confidence or error).` : ''}`
        : 'No posts were enhanced. All posts either had low confidence scores or encountered errors.'

    logger.info('[dispatch-campaign] Campaign dispatch complete', {
      campaignId,
      orgId,
      enhanced: result.enhanced,
      skipped: result.skipped,
    })

    return NextResponse.json({
      success: true,
      campaignId,
      enhanced: result.enhanced,
      skipped: result.skipped,
      message,
    })
  } catch (err) {
    logger.error('[dispatch-campaign] POST failed', { campaignId, orgId, error: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
