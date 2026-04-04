/**
 * Cross-Post Service
 *
 * @description Orchestrates the full cross-posting workflow:
 * 1. Uses MultiFormatAdapter to generate platform-specific content variants
 * 2. Uses platform services to post to each selected platform
 * 3. Saves Post records to the database
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token decryption (CRITICAL)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openrouter")
 *
 * @module lib/ai/cross-post-service
 */

import { multiFormatAdapter, AdaptedContent, PlatformVariant } from '@/lib/ai/multi-format-adapter';
import { createPlatformService, SUPPORTED_PLATFORMS, SupportedPlatform } from '@/lib/social';
import { prisma } from '@/lib/prisma';
import { decryptField } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CrossPostParams {
  /** The content to cross-post */
  sourceContent: string;
  /** Target platforms to post to */
  platforms: SupportedPlatform[];
  /** User ID for database operations */
  userId: string;
  /** Optional tone override */
  tone?: string;
  /** Content goal (engagement, reach, etc.) */
  goal?: string;
  /** Brand voice persona ID */
  personaId?: string;
  /** Optional scheduled posting time */
  scheduledAt?: Date;
  /** Optional media URLs to attach */
  mediaUrls?: string[];
  /** Optional campaign association */
  campaignId?: string;
}

export interface PlatformPostResult {
  platform: SupportedPlatform;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  /** Database post ID if saved */
  dbPostId?: string;
}

export interface CrossPostResult {
  /** The adapted content variants from MultiFormatAdapter */
  adaptedContent: AdaptedContent;
  /** Results of posting to each platform */
  results: PlatformPostResult[];
  /** Number of posts scheduled (if scheduledAt was provided) */
  scheduledCount: number;
  /** Number of posts published immediately */
  publishedCount: number;
  /** Number of posts that failed */
  failedCount: number;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * CrossPostService orchestrates content adaptation and multi-platform posting.
 *
 * @example
 * // Preview adaptations before posting
 * const preview = await crossPostService.previewCrossPost({
 *   sourceContent: 'Your content here',
 *   platforms: ['twitter', 'linkedin', 'instagram'],
 *   userId: 'user123',
 * });
 *
 * // Full cross-post workflow
 * const result = await crossPostService.crossPost({
 *   sourceContent: 'Your content here',
 *   platforms: ['twitter', 'linkedin'],
 *   userId: 'user123',
 *   tone: 'professional',
 *   goal: 'engagement',
 * });
 */
export class CrossPostService {
  /**
   * Preview content adaptations without posting.
   * Use this to show users what their content will look like on each platform.
   */
  async previewCrossPost(params: Omit<CrossPostParams, 'scheduledAt' | 'campaignId'>): Promise<AdaptedContent> {
    const { sourceContent, platforms, tone, goal } = params;

    logger.info('[CrossPostService] Generating preview adaptations', {
      platformCount: platforms.length,
      platforms,
      tone,
      goal,
    });

    const adaptedContent = await multiFormatAdapter.adaptContent({
      sourceContent,
      targetPlatforms: platforms,
      tone,
      goal,
    });

    logger.info('[CrossPostService] Preview adaptations generated', {
      variantCount: adaptedContent.variants.length,
    });

    return adaptedContent;
  }

  /**
   * Full cross-posting workflow:
   * 1. Adapt content for each platform using MultiFormatAdapter
   * 2. Get user's platform connections and decrypt tokens
   * 3. Post to each platform (or schedule for later)
   * 4. Save Post records to database
   */
  async crossPost(params: CrossPostParams): Promise<CrossPostResult> {
    const {
      sourceContent,
      platforms,
      userId,
      tone,
      goal,
      scheduledAt,
      mediaUrls,
      campaignId,
    } = params;

    logger.info('[CrossPostService] Starting cross-post workflow', {
      userId,
      platformCount: platforms.length,
      platforms,
      hasScheduledAt: !!scheduledAt,
      hasCampaignId: !!campaignId,
    });

    // Step 1: Adapt content for all platforms
    const adaptedContent = await multiFormatAdapter.adaptContent({
      sourceContent,
      targetPlatforms: platforms,
      tone,
      goal,
    });

    logger.info('[CrossPostService] Content adapted for platforms', {
      variantCount: adaptedContent.variants.length,
    });

    // Step 2: Create or get campaign
    let finalCampaignId = campaignId;
    if (!finalCampaignId) {
      const campaign = await prisma.campaign.create({
        data: {
          name: `Cross-Post - ${new Date().toLocaleDateString()}`,
          description: 'Auto-generated campaign for cross-posting',
          platform: platforms.join(','),
          status: 'active',
          userId,
        },
      });
      finalCampaignId = campaign.id;
      logger.info('[CrossPostService] Created campaign', { campaignId: finalCampaignId });
    }

    // Step 3: Post to each platform
    const results: PlatformPostResult[] = [];
    let scheduledCount = 0;
    let publishedCount = 0;
    let failedCount = 0;

    for (const variant of adaptedContent.variants) {
      const platform = variant.platform as SupportedPlatform;
      const result = await this.postToPlatform({
        variant,
        platform,
        userId,
        scheduledAt,
        mediaUrls,
        campaignId: finalCampaignId,
      });

      results.push(result);

      if (result.success) {
        if (scheduledAt) {
          scheduledCount++;
        } else {
          publishedCount++;
        }
      } else {
        failedCount++;
      }
    }

    // Step 4: Update campaign analytics
    await prisma.campaign.update({
      where: { id: finalCampaignId },
      data: {
        analytics: {
          postsCreated: results.length,
          postsPublished: publishedCount,
          postsScheduled: scheduledCount,
          postsFailed: failedCount,
          platformsUsed: platforms,
          lastPostedAt: scheduledAt || new Date(),
        },
      },
    });

    logger.info('[CrossPostService] Cross-post workflow completed', {
      publishedCount,
      scheduledCount,
      failedCount,
    });

    return {
      adaptedContent,
      results,
      scheduledCount,
      publishedCount,
      failedCount,
    };
  }

  /**
   * Post a single variant to a platform.
   */
  private async postToPlatform(params: {
    variant: PlatformVariant;
    platform: SupportedPlatform;
    userId: string;
    scheduledAt?: Date;
    mediaUrls?: string[];
    campaignId: string;
  }): Promise<PlatformPostResult> {
    const { variant, platform, userId, scheduledAt, mediaUrls, campaignId } = params;

    try {
      // Get platform connection
      const connection = await prisma.platformConnection.findFirst({
        where: {
          userId,
          platform,
          isActive: true,
        },
      });

      if (!connection) {
        // No connection — save as draft
        const post = await prisma.post.create({
          data: {
            content: variant.content,
            platform,
            status: 'draft',
            campaignId,
            metadata: {
              noConnection: true,
              hashtags: variant.metadata.hashtags,
              characterCount: variant.metadata.characterCount,
              mediaUrls,
            },
          },
        });

        logger.warn('[CrossPostService] No platform connection found', {
          platform,
          userId,
          postId: post.id,
        });

        return {
          platform,
          success: false,
          error: `No active ${platform} connection found. Connect your account in Settings > Integrations.`,
          dbPostId: post.id,
        };
      }

      // Decrypt access token
      const accessToken = decryptField(connection.accessToken);
      if (!accessToken) {
        return {
          platform,
          success: false,
          error: `Failed to decrypt ${platform} credentials`,
        };
      }

      // If scheduled, save as scheduled post
      if (scheduledAt) {
        const post = await prisma.post.create({
          data: {
            content: variant.content,
            platform,
            status: 'scheduled',
            scheduledAt,
            campaignId,
            metadata: {
              hashtags: variant.metadata.hashtags,
              characterCount: variant.metadata.characterCount,
              mediaUrls,
              format: variant.format,
            },
          },
        });

        logger.info('[CrossPostService] Post scheduled', {
          platform,
          postId: post.id,
          scheduledAt,
        });

        return {
          platform,
          success: true,
          dbPostId: post.id,
        };
      }

      // Create platform service and post immediately
      const service = createPlatformService(platform, {
        accessToken,
        refreshToken: connection.refreshToken ? decryptField(connection.refreshToken) || undefined : undefined,
        expiresAt: connection.expiresAt || undefined,
        platformUserId: connection.profileId || undefined,
        platformUsername: connection.profileName || undefined,
      });

      if (!service) {
        return {
          platform,
          success: false,
          error: `${platform} service not supported`,
        };
      }

      // Post to platform
      const postResult = await service.createPost({
        text: variant.content,
        mediaUrls,
      });

      // Save post record
      const post = await prisma.post.create({
        data: {
          content: variant.content,
          platform,
          status: postResult.success ? 'published' : 'failed',
          publishedAt: postResult.success ? new Date() : null,
          campaignId,
          metadata: {
            platformPostId: postResult.postId,
            url: postResult.url,
            hashtags: variant.metadata.hashtags,
            characterCount: variant.metadata.characterCount,
            mediaUrls,
            format: variant.format,
            error: postResult.error,
          },
        },
      });

      if (postResult.success) {
        logger.info('[CrossPostService] Post published', {
          platform,
          postId: post.id,
          platformPostId: postResult.postId,
        });
      } else {
        logger.error('[CrossPostService] Post failed', {
          platform,
          postId: post.id,
          error: postResult.error,
        });
      }

      return {
        platform,
        success: postResult.success,
        postId: postResult.postId,
        url: postResult.url,
        error: postResult.error,
        dbPostId: post.id,
      };
    } catch (error) {
      logger.error('[CrossPostService] Platform posting error', {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

/** Singleton instance for use across the application. */
export const crossPostService = new CrossPostService();
