/**
 * Threads Posting API
 *
 * @description Post content to Threads via Meta Graph API
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - THREADS_APP_ID: Threads/Meta App ID (SECRET)
 * - THREADS_APP_SECRET: Threads/Meta App Secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPlatformService, type PlatformCredentials } from '@/lib/social';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { decryptField } from '@/lib/security/field-encryption';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';
import { scheduleViaPost } from '@/lib/social/schedule-via-post';

// Usage metering used to write to a Supabase `usage_tracking` table that has
// no Prisma model. It is reported as not recorded instead of silently dropped.
const USAGE_NOT_PROVISIONED = {
  recorded: false,
  reason: 'FEATURE_NOT_PROVISIONED: usage_tracking table is not provisioned',
} as const;

/** The caller's own active Threads connection, scoped to their effective org. */
async function findThreadsConnection(userId: string) {
  const organizationId = await getEffectiveOrganizationId(userId);
  return prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: 'threads',
      organizationId: organizationId ?? null,
      isActive: true,
      deletedAt: null,
    },
  });
}

type ThreadsConnection = NonNullable<
  Awaited<ReturnType<typeof findThreadsConnection>>
>;

/** Decrypt stored OAuth tokens; null when the access token is unusable. */
function toCredentials(
  connection: ThreadsConnection
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
  'Threads access token could not be decrypted. Please reconnect your Threads account.';

// Request validation schema
const PostRequestSchema = z.object({
  content: z.string().max(500, 'Thread text must be 500 characters or less'),
  mediaUrls: z.array(z.string().url()).optional(),
  mediaType: z.enum(['TEXT', 'IMAGE', 'VIDEO']).default('TEXT'),
  replyControl: z
    .enum(['everyone', 'accounts_you_follow', 'mentioned_only'])
    .optional(),
  scheduledAt: z.string().datetime().optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/threads/post
 * Create a new Threads post
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
            error: 'Direct Threads publishing route disabled',
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

      // Get user's Threads connection
      const connection = await findThreadsConnection(userId);

      if (!connection) {
        return NextResponse.json(
          {
            error:
              'Threads account not connected. Please connect your Threads account first.',
          },
          { status: 400 }
        );
      }

      const credentials = toCredentials(connection);
      if (!credentials) {
        return NextResponse.json({ error: RECONNECT_ERROR }, { status: 400 });
      }

      // Create Threads service via factory (handles initialization + token refresh)
      const threadsService = createPlatformService('threads', credentials, {
        connectionId: connection.id,
      });

      if (!threadsService) {
        return NextResponse.json(
          { error: 'Threads service unavailable' },
          { status: 500 }
        );
      }

      // Handle scheduled posts.
      // Route through the WORKING scheduler (Post + cron). The previous path
      // inserted into the `scheduled_posts` table drained by a BullMQ worker
      // that is never booted, so scheduled posts were silently lost (P1).
      if (postData.scheduledAt) {
        const scheduled = await scheduleViaPost({
          userId,
          platform: 'threads',
          content: postData.content,
          scheduledTime: new Date(postData.scheduledAt),
          mediaUrls: postData.mediaUrls || [],
          metadata: {
            mediaType: postData.mediaType,
            replyControl: postData.replyControl,
          },
        });

        // Log the scheduled action
        await auditLogger.logData(
          'create',
          'scheduled_post',
          scheduled.id,
          userId,
          'success',
          {
            action: 'threads_post_scheduled',
            scheduledTime: postData.scheduledAt,
            mediaType: postData.mediaType,
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

      // Create the post
      const result = await threadsService.createPost({
        text: postData.content,
        mediaUrls: postData.mediaUrls,
        metadata: { replyControl: postData.replyControl },
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create Threads post' },
          { status: 500 }
        );
      }

      // Save post to database (platform_posts, scoped via the caller's connection)
      const savedPost = result.postId
        ? await prisma.platformPost.upsert({
            where: {
              connectionId_platformId: {
                connectionId: connection.id,
                platformId: result.postId,
              },
            },
            create: {
              connectionId: connection.id,
              platformId: result.postId,
              content: postData.content,
              mediaUrls: postData.mediaUrls || [],
              status: 'published',
              publishedAt: new Date(),
              metadata: {
                mediaType: postData.mediaType,
                source: 'api/social/threads/post',
              },
            },
            update: { status: 'published' },
          })
        : null;

      // Log the action
      await auditLogger.logData(
        'create',
        'social_post',
        result.postId || savedPost?.id,
        userId,
        'success',
        {
          action: 'threads_post_created',
          mediaType: postData.mediaType,
          replyControl: postData.replyControl || 'everyone',
          usageFeature: 'threads_post',
          usageCount: 1,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          id: result.postId,
          url: result.url,
          content: postData.content,
          mediaType: postData.mediaType,
        },
        recorded: Boolean(savedPost),
        usage: USAGE_NOT_PROVISIONED,
      });
    } catch (error: unknown) {
      logger.error('Threads post error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      return NextResponse.json(
        {
          error: 'Failed to post to Threads',
          message: errorMessage,
        },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/social/threads/post
 * Get user's Threads posts
 */
export async function GET(request: NextRequest) {
  try {
    // Security check
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

    // Get user from token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const syncFromPlatform = searchParams.get('sync') === 'true';

    // Get user's Threads connection
    const connection = await findThreadsConnection(userId);

    if (!connection) {
      return NextResponse.json(
        { error: 'Threads account not connected' },
        { status: 400 }
      );
    }

    // If sync requested, fetch from Threads API
    let syncError: string | undefined;
    if (syncFromPlatform) {
      const credentials = toCredentials(connection);
      if (!credentials) {
        return NextResponse.json({ error: RECONNECT_ERROR }, { status: 400 });
      }

      const threadsService = createPlatformService('threads', credentials, {
        connectionId: connection.id,
      });

      const syncResult = threadsService
        ? await threadsService.syncPosts(limit, cursor)
        : {
            success: false,
            posts: [],
            total: 0,
            hasMore: false,
            error: 'Service unavailable',
          };
      if (!syncResult.success) {
        syncError = syncResult.error || 'Threads sync failed';
      }

      if (syncResult.success) {
        // Update database with synced posts
        for (const post of syncResult.posts) {
          const fields = {
            content: post.content,
            mediaUrls: post.mediaUrls ?? [],
            publishedAt: post.publishedAt,
            status: 'published',
            metadata: { metrics: { ...post.metrics } },
          };
          await prisma.platformPost.upsert({
            where: {
              connectionId_platformId: {
                connectionId: connection.id,
                platformId: post.platformId,
              },
            },
            create: {
              connectionId: connection.id,
              platformId: post.platformId,
              ...fields,
            },
            update: fields,
          });
        }

        return NextResponse.json({
          success: true,
          data: syncResult.posts,
          hasMore: syncResult.hasMore,
          cursor: syncResult.cursor,
          synced: true,
        });
      }
    }

    // Get posts from database (only the caller's own connection)
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
    logger.error('Get Threads posts error:', error);
    const errorMessage = 'An unexpected error occurred. Please try again.';
    return NextResponse.json(
      { error: 'Failed to get Threads posts', message: errorMessage },
      { status: 500 }
    );
  }
}
