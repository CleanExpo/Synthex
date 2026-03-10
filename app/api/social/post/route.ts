/**
 * Unified Social Media Posting API
 * Handles posting to multiple social media platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { decryptField } from '@/lib/security/field-encryption';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { createPlatformService, type SupportedPlatform, type PlatformCredentials } from '@/lib/social';
import { logger } from '@/lib/logger';

const socialPostSchema = z.object({
  content: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
  mentions: z.array(z.string()).optional().default([]),
  campaignId: z.string().optional(),
});


export async function POST(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = socialPostSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      content,
      platforms,
      mediaUrls,
      scheduledAt,
      hashtags,
      mentions,
      campaignId
    } = validation.data;

    // Process hashtags
    const processedHashtags = hashtags.map(tag => 
      tag.startsWith('#') ? tag : `#${tag}`
    );

    // Add hashtags to content if not already included
    let finalContent = content;
    const hashtagString = processedHashtags.join(' ');
    if (hashtagString && !content.includes(hashtagString)) {
      finalContent = `${content}\n\n${hashtagString}`;
    }

    // Post to each platform (external API calls — must happen outside transaction)
    const platformResults: { platform: string; postId: string; url: string }[] = [];
    const errors: { platform: string; success: boolean; error: string }[] = [];

    for (const platform of platforms) {
      try {
        // Get platform connection (scoped by organization)
        const connection = await prisma.platformConnection.findFirst({
          where: {
            userId,
            platform,
            organizationId: organizationId ?? null,
            isActive: true
          }
        });

        if (!connection) {
          errors.push({
            platform,
            success: false,
            error: `Not connected to ${platform}. Please connect your ${platform} account in Settings.`
          });
          continue;
        }

        // Build per-user credentials from stored OAuth tokens
        const accessToken = decryptField(connection.accessToken);
        if (!accessToken) {
          errors.push({
            platform,
            success: false,
            error: `Access token for ${platform} could not be decrypted. Please reconnect your account.`
          });
          continue;
        }
        const credentials: PlatformCredentials = {
          accessToken,
          refreshToken: connection.refreshToken ? decryptField(connection.refreshToken) ?? undefined : undefined,
          expiresAt: connection.expiresAt ?? undefined,
          platformUserId: connection.profileId ?? undefined,
          platformUsername: connection.profileName ?? undefined,
        };

        const service = createPlatformService(platform as SupportedPlatform, credentials);

        if (!service) {
          errors.push({
            platform,
            success: false,
            error: `Platform ${platform} is not supported`
          });
          continue;
        }

        // Post via per-user OAuth token
        const result = await service.createPost({ text: finalContent, mediaUrls });

        if (!result.success || !result.postId) {
          throw new Error(result.error || `Failed to post to ${platform}`);
        }

        platformResults.push({
          platform,
          postId: result.postId,
          url: result.url || '',
        });

      } catch (error: unknown) {
        logger.error(`Error posting to ${platform}:`, error);
        errors.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : String(error) || `Failed to post to ${platform}`
        });
      }
    }

    // Persist all DB writes atomically: campaign creation + post records + analytics
    const { finalCampaignId, results } = await prisma.$transaction(async (tx) => {
      // Create campaign if not provided
      let txCampaignId = campaignId;
      if (!campaignId) {
        const campaign = await tx.campaign.create({
          data: {
            name: `Social Post - ${new Date().toLocaleDateString()}`,
            description: 'Auto-generated campaign for social media post',
            platform: platforms.join(','),
            status: 'active',
            userId
          }
        });
        txCampaignId = campaign.id;
      }

      // Save all successful platform posts to database
      const postResults: { platform: string; success: boolean; postId: string; platformPostId: string; url: string; message: string }[] = [];

      for (const result of platformResults) {
        const post = await tx.post.create({
          data: {
            content: finalContent,
            platform: result.platform,
            status: scheduledAt ? 'scheduled' : 'published',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            publishedAt: scheduledAt ? null : new Date(),
            campaignId: txCampaignId!,
            metadata: {
              platformPostId: result.postId,
              url: result.url,
              hashtags: processedHashtags,
              mentions,
              mediaUrls
            }
          }
        });

        postResults.push({
          platform: result.platform,
          success: true,
          postId: post.id,
          platformPostId: result.postId,
          url: result.url,
          message: `Successfully posted to ${result.platform}`
        });
      }

      // Update campaign analytics
      if (txCampaignId) {
        await tx.campaign.update({
          where: { id: txCampaignId },
          data: {
            analytics: {
              postsCreated: postResults.length,
              platformsUsed: platforms,
              lastPostedAt: new Date()
            }
          }
        });
      }

      return { finalCampaignId: txCampaignId, results: postResults };
    });

    // Return response
    return NextResponse.json({
      success: errors.length === 0,
      message: `Posted to ${results.length} of ${platforms.length} platforms`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      campaign: {
        id: finalCampaignId,
        postsCreated: results.length
      }
    });

  } catch (error: unknown) {
    logger.error('Social posting error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to social media',
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

// Get posting history
export async function GET(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;
    // Scope to current user via campaign relation
    where['campaign'] = { userId };

    // Get posts from database
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Get platform statistics
    const stats = await prisma.post.groupBy({
      by: ['platform', 'status'],
      where: { campaign: { userId } },
      _count: {
        id: true
      }
    });

    return NextResponse.json({
      posts,
      stats: stats.map(s => ({
        platform: s.platform,
        status: s.status,
        count: s._count.id
      })),
      total: posts.length
    });

  } catch (error: unknown) {
    logger.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
