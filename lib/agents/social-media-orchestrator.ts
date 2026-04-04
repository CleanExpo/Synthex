/**
 * Social Media Orchestrator — Phase 67
 *
 * Orchestrates multi-platform content dispatch using the waterfall cascade
 * strategy defined in platform_master_config.json.
 *
 * Waterfall order: youtube → linkedin → instagram → facebook → twitter →
 *   tiktok → pinterest → reddit → threads
 * Stagger: 30 minutes between platforms.
 * DB update threshold: confidence >= 0.70 triggers Prisma post update.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { PlatformSpecialistAgent } from './platform-specialist'
import type { SocialPlatform } from './platform-specialist'

// ============================================================================
// TYPES
// ============================================================================

export interface DispatchParams {
  postId: string
  baseContent: string
  platforms: SocialPlatform[]
  orgId: string
  businessName: string
  businessIndustry?: string
  scheduledAt?: Date
}

export interface PlatformDispatch {
  platform: string
  enhancedContent: string
  scheduledAt: Date
  confidenceScore: number
}

export interface DispatchResult {
  dispatched: PlatformDispatch[]
  skipped: string[]
  totalEnhanced: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Waterfall cascade order from platform_master_config.json */
const WATERFALL_ORDER: SocialPlatform[] = [
  'youtube',
  'linkedin',
  'instagram',
  'facebook',
  'twitter',
  'tiktok',
  'pinterest',
  'reddit',
  'threads',
]

/** Minimum confidence required to persist enhanced content to DB */
const CONFIDENCE_THRESHOLD = 0.70

/** Minutes to stagger each platform in the waterfall */
const STAGGER_MINUTES = 30

// ============================================================================
// SOCIAL MEDIA ORCHESTRATOR
// ============================================================================

export class SocialMediaOrchestrator {
  private specialist = new PlatformSpecialistAgent()

  /**
   * Dispatch a post to one or more platforms via the waterfall cascade.
   *
   * Each platform's enhanced content is persisted to the Post record in DB
   * only when the AI confidence score meets the threshold (>= 0.70).
   * Platforms are scheduled with a 30-minute stagger in waterfall order.
   */
  async dispatchPost(params: DispatchParams): Promise<DispatchResult> {
    const { postId, baseContent, platforms, orgId, businessName, businessIndustry, scheduledAt } = params

    // Sort requested platforms according to waterfall cascade order
    const orderedPlatforms = WATERFALL_ORDER.filter((p) => platforms.includes(p))
    const requestedSet = new Set(platforms)
    const unknownPlatforms = platforms.filter((p) => !WATERFALL_ORDER.includes(p))

    const baseTime = scheduledAt ?? new Date()
    const dispatched: PlatformDispatch[] = []
    const skipped: string[] = [...unknownPlatforms]

    logger.info('social-media-orchestrator: starting dispatch', {
      postId,
      orgId,
      platforms: orderedPlatforms,
      baseTime,
    })

    for (let i = 0; i < orderedPlatforms.length; i++) {
      const platform = orderedPlatforms[i]
      const platformScheduledAt = new Date(baseTime.getTime() + i * STAGGER_MINUTES * 60 * 1000)

      try {
        const enhanced = await this.specialist.enhance({
          content: baseContent,
          platform,
          businessName,
          businessIndustry,
          orgId,
        })

        const { confidenceScore } = enhanced.metadata

        if (confidenceScore >= CONFIDENCE_THRESHOLD) {
          // Persist enhanced content to DB
          const platformMetadata = {
            platform,
            enhancedAt: new Date().toISOString(),
            hashtags: enhanced.hashtags,
            format: enhanced.metadata.format,
            optimalPostingTime: enhanced.metadata.optimalPostingTime,
            winningTemplate: enhanced.metadata.winningTemplate,
            confidenceScore,
            suggestions: enhanced.suggestions,
          }

          await prisma.post.update({
            where: { id: postId },
            data: {
              content: enhanced.content,
              metadata: { ...platformMetadata } as never,
              scheduledAt: platformScheduledAt,
            },
          })

          dispatched.push({
            platform,
            enhancedContent: enhanced.content,
            scheduledAt: platformScheduledAt,
            confidenceScore,
          })

          logger.info('social-media-orchestrator: platform dispatched', {
            postId,
            platform,
            confidenceScore,
            scheduledAt: platformScheduledAt,
          })
        } else {
          skipped.push(platform)
          logger.info('social-media-orchestrator: platform skipped (low confidence)', {
            postId,
            platform,
            confidenceScore,
            threshold: CONFIDENCE_THRESHOLD,
          })
        }
      } catch (err) {
        skipped.push(platform)
        logger.error('social-media-orchestrator: platform dispatch failed', {
          postId,
          platform,
          error: err,
        })
      }
    }

    // Add any platforms that were requested but not in the waterfall order
    for (const unknown of unknownPlatforms) {
      if (requestedSet.has(unknown as SocialPlatform)) {
        logger.warn('social-media-orchestrator: unrecognised platform skipped', {
          postId,
          platform: unknown,
        })
      }
    }

    return {
      dispatched,
      skipped,
      totalEnhanced: dispatched.length,
    }
  }

  /**
   * Enhance all posts in a campaign across their target platforms.
   *
   * Fetches each post, determines its target platform from post.platform,
   * and calls dispatchPost for each.
   */
  async enhanceCampaign(
    campaignId: string,
    orgId: string
  ): Promise<{ enhanced: number; skipped: number }> {
    // Verify campaign belongs to the org
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId },
      select: { id: true, name: true, userId: true },
    })

    if (!campaign) {
      logger.warn('social-media-orchestrator: campaign not found or not in org', {
        campaignId,
        orgId,
      })
      return { enhanced: 0, skipped: 0 }
    }

    // Fetch the org's brand details for context
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, industry: true },
    })

    const businessName = org?.name ?? 'Unknown Business'
    const businessIndustry = org?.industry ?? undefined

    // Fetch all non-deleted posts for this campaign
    const posts = await prisma.post.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true, content: true, platform: true, scheduledAt: true },
    })

    logger.info('social-media-orchestrator: enhancing campaign', {
      campaignId,
      orgId,
      postCount: posts.length,
    })

    let totalEnhanced = 0
    let totalSkipped = 0

    for (const post of posts) {
      try {
        const platform = post.platform as SocialPlatform
        const result = await this.dispatchPost({
          postId: post.id,
          baseContent: post.content,
          platforms: [platform],
          orgId,
          businessName,
          businessIndustry,
          scheduledAt: post.scheduledAt ?? undefined,
        })

        totalEnhanced += result.totalEnhanced
        totalSkipped += result.skipped.length
      } catch (err) {
        totalSkipped++
        logger.error('social-media-orchestrator: post enhancement failed in campaign run', {
          campaignId,
          postId: post.id,
          error: err,
        })
      }
    }

    logger.info('social-media-orchestrator: campaign enhancement complete', {
      campaignId,
      orgId,
      enhanced: totalEnhanced,
      skipped: totalSkipped,
    })

    return { enhanced: totalEnhanced, skipped: totalSkipped }
  }
}
