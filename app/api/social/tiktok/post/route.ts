/**
 * TikTok Posting API
 *
 * @description Post videos to TikTok via TikTokService (BasePlatformService)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TIKTOK_CLIENT_KEY: TikTok app client key (SECRET)
 * - TIKTOK_CLIENT_SECRET: TikTok app client secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { decryptField } from '@/lib/security/field-encryption';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { auditLogger } from '@/lib/security/audit-logger';
import { createPlatformService, type PlatformCredentials } from '@/lib/social';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';
import { scheduleViaPost } from '@/lib/social/schedule-via-post';

// Usage metering used to write to a Supabase `usage_tracking` table that has
// no Prisma model. It is reported as not recorded instead of silently dropped.
const USAGE_NOT_PROVISIONED = {
  recorded: false,
  reason: 'FEATURE_NOT_PROVISIONED: usage_tracking table is not provisioned',
} as const;

/** The caller's own active TikTok connection, scoped to their effective org. */
async function findTikTokConnection(userId: string) {
  const organizationId = await getEffectiveOrganizationId(userId);
  return prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: 'tiktok',
      organizationId: organizationId ?? null,
      isActive: true,
      deletedAt: null,
    },
  });
}

type TikTokConnection = NonNullable<
  Awaited<ReturnType<typeof findTikTokConnection>>
>;

/** Decrypt stored OAuth tokens; null when the access token is unusable. */
function toCredentials(
  connection: TikTokConnection
): PlatformCredentials | null {
  const accessToken = decryptField(connection.accessToken);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: connection.refreshToken
      ? (decryptField(connection.refreshToken) ?? undefined)
      : undefined,
    expiresAt: connection.expiresAt ?? undefined,
    platformUserId: connection.profileId ?? undefined,
    platformUsername: connection.profileName ?? undefined,
  };
}

const RECONNECT_ERROR =
  'TikTok access token could not be decrypted. Please reconnect your TikTok account.';

// Request validation schema
const PostRequestSchema = z.object({
  videoUrl: z.string().url('Valid video URL required'),
  caption: z
    .string()
    .max(2200, 'Caption must be 2200 characters or less')
    .optional(),
  privacy: z.enum(['PUBLIC', 'FRIENDS', 'SELF']).default('PUBLIC'),
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  scheduledTime: z.string().datetime().optional(),
  hashtags: z.array(z.string()).optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * Map route-level privacy values to service-level visibility
 */
function mapPrivacyToVisibility(
  privacy: string
): 'public' | 'connections' | 'private' {
  switch (privacy) {
    case 'SELF':
      return 'private';
    case 'FRIENDS':
      return 'connections';
    case 'PUBLIC':
    default:
      return 'public';
  }
}

/**
 * POST /api/social/tiktok/post
 * Create a new TikTok video post
 */
export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      // Security check
      const security = await APISecurityChecker.check(
        request,
        DEFAULT_POLICIES.AUTHENTICATED_WRITE
      );

      if (!security.allowed) {
        return APISecurityChecker.createSecureResponse(
          { error: security.error },
          403
        );
      }

      // Get user from token
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      if (process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS !== 'true') {
        return NextResponse.json(
          {
            error: 'Direct TikTok publishing route disabled',
            message:
              'Use /api/social/post so Synthex can enforce organization-scoped page ownership, campaign authority gates, and platform receipts.',
          },
          { status: 409 }
        );
      }

      // Parse and validate request body
      const body = await request.json();
      const validation = PostRequestSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const postData: PostRequest = validation.data;

      // Get user's TikTok connection
      const connection = await findTikTokConnection(userId);

      if (!connection) {
        return NextResponse.json(
          {
            error:
              'TikTok account not connected. Please connect your TikTok account first.',
          },
          { status: 400 }
        );
      }

      // Handle scheduled posts.
      // Route through the WORKING scheduler (Post + cron). The previous path
      // inserted into the `scheduled_posts` table drained by a BullMQ worker
      // that is never booted, so scheduled posts were silently lost (P1).
      if (postData.scheduledTime) {
        const scheduled = await scheduleViaPost({
          userId,
          platform: 'tiktok',
          content: postData.caption || '',
          scheduledTime: new Date(postData.scheduledTime),
          mediaUrls: [postData.videoUrl],
          metadata: {
            privacy: postData.privacy,
            disableComment: postData.disableComment,
            disableDuet: postData.disableDuet,
            disableStitch: postData.disableStitch,
            hashtags: postData.hashtags,
          },
        });

        await auditLogger.logData(
          'create',
          'scheduled_post',
          scheduled.id,
          userId,
          'success',
          {
            action: 'tiktok_post_scheduled',
            scheduledTime: postData.scheduledTime,
          }
        );

        return NextResponse.json({
          success: true,
          scheduled: true,
          data: {
            id: scheduled.id,
            scheduledTime: scheduled.scheduledAt,
            status: scheduled.status,
          },
        });
      }

      // Build caption with hashtags
      let fullCaption = postData.caption || '';
      if (postData.hashtags && postData.hashtags.length > 0) {
        const hashtagString = postData.hashtags
          .map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
          .join(' ');
        fullCaption = fullCaption
          ? `${fullCaption} ${hashtagString}`
          : hashtagString;
      }

      const credentials = toCredentials(connection);
      if (!credentials) {
        return NextResponse.json({ error: RECONNECT_ERROR }, { status: 400 });
      }

      // Create TikTok service via factory
      const service = createPlatformService('tiktok', credentials, {
        connectionId: connection.id,
      });

      if (!service) {
        return NextResponse.json(
          { error: 'TikTok service unavailable' },
          { status: 500 }
        );
      }

      // Use service to create the post
      const result = await service.createPost({
        text: fullCaption,
        mediaUrls: [postData.videoUrl],
        visibility: mapPrivacyToVisibility(postData.privacy),
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to initialize TikTok video upload' },
          { status: 500 }
        );
      }

      const publishId = result.postId;

      // Save post to database (platform_posts, scoped via the caller's
      // connection; status will be updated via webhook)
      const savedPost = publishId
        ? await prisma.platformPost.upsert({
            where: {
              connectionId_platformId: {
                connectionId: connection.id,
                platformId: publishId,
              },
            },
            create: {
              connectionId: connection.id,
              platformId: publishId,
              content: fullCaption,
              mediaUrls: [postData.videoUrl],
              status: 'processing', // TikTok processes async
              metadata: {
                mediaType: 'VIDEO',
                source: 'api/social/tiktok/post',
              },
            },
            update: { status: 'processing' },
          })
        : null;

      await auditLogger.logData(
        'create',
        'social_post',
        publishId || '',
        userId,
        'success',
        {
          action: 'tiktok_post_initiated',
          privacy: postData.privacy,
          usageFeature: 'tiktok_post',
          usageCount: 1,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          publishId,
          status: 'processing',
          message: 'Video upload initiated. TikTok will process the video.',
          caption: fullCaption,
        },
        recorded: Boolean(savedPost),
        usage: USAGE_NOT_PROVISIONED,
      });
    } catch (error: unknown) {
      logger.error('TikTok post error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      return NextResponse.json(
        { error: 'Failed to post to TikTok', message: errorMessage },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/social/tiktok/post
 * Get user's TikTok posts
 */
export async function GET(request: NextRequest) {
  try {
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const syncFromPlatform = searchParams.get('sync') === 'true';

    const connection = await findTikTokConnection(userId);

    if (!connection) {
      return NextResponse.json(
        { error: 'TikTok account not connected' },
        { status: 400 }
      );
    }

    let syncError: string | undefined;
    if (syncFromPlatform) {
      // Use TikTok service to sync posts from platform
      try {
        const credentials = toCredentials(connection);
        const service = credentials
          ? createPlatformService('tiktok', credentials, {
              connectionId: connection.id,
            })
          : null;

        if (!service) syncError = 'TikTok service unavailable';
        if (service) {
          const syncResult = await service.syncPosts(limit);
          if (!syncResult.success) {
            syncError = syncResult.error || 'TikTok sync failed';
          }

          if (syncResult.success) {
            // Map to the existing response format to preserve API contract
            const videos = syncResult.posts.map((post: any) => ({
              id: post.id,
              platformId: post.platformId,
              content: post.content,
              publishedAt: post.publishedAt,
              url: post.url,
              metrics: {
                likes: post.metrics.likes,
                comments: post.metrics.comments,
                shares: post.metrics.shares,
                views: post.metrics.impressions || 0,
              },
            }));

            return NextResponse.json({
              success: true,
              data: videos,
              synced: true,
            });
          }
        }
      } catch (err) {
        logger.error('TikTok sync error:', err);
        syncError = 'TikTok sync failed';
        // Fall through to database query
      }
    }

    // Stored posts for the caller's own connection only
    const posts = await prisma.platformPost.findMany({
      where: { connectionId: connection.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: posts,
      // A requested sync that failed must not look like fresh platform data.
      ...(syncFromPlatform ? { synced: false, syncError } : {}),
    });
  } catch (error: unknown) {
    logger.error('Get TikTok posts error:', error);
    const errorMessage = 'An unexpected error occurred. Please try again.';
    return NextResponse.json(
      { error: 'Failed to get TikTok posts', message: errorMessage },
      { status: 500 }
    );
  }
}
