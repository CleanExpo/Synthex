/**
 * Reddit Posting API
 *
 * @description Create and retrieve Reddit posts via Reddit API
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDDIT_CLIENT_ID: Reddit API client ID (SECRET)
 * - REDDIT_CLIENT_SECRET: Reddit API client secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createPlatformService,
  RedditService,
  type PlatformCredentials,
} from '@/lib/social';
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

/** The caller's own active Reddit connection, scoped to their effective org. */
async function findRedditConnection(userId: string) {
  const organizationId = await getEffectiveOrganizationId(userId);
  return prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: 'reddit',
      organizationId: organizationId ?? null,
      isActive: true,
      deletedAt: null,
    },
  });
}

type RedditConnection = NonNullable<
  Awaited<ReturnType<typeof findRedditConnection>>
>;

/** Decrypt stored OAuth tokens; null when the access token is unusable. */
function toCredentials(
  connection: RedditConnection
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
  'Reddit access token could not be decrypted. Please reconnect your Reddit account.';

// Request validation schema — title and subreddit are REQUIRED for Reddit posts
const PostRequestSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or less'),
  content: z
    .string()
    .max(40000, 'Content must be 40,000 characters or less')
    .optional(),
  url: z.string().url().optional(),
  subreddit: z.string().min(1, 'Subreddit is required').max(100),
  kind: z.enum(['self', 'link']).default('self'),
  flair_id: z.string().optional(),
  flair_text: z.string().optional(),
  nsfw: z.boolean().optional(),
  spoiler: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/reddit/post
 * Create a new Reddit post
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
            error: 'Direct Reddit publishing route disabled',
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

      // Get user's Reddit connection
      const connection = await findRedditConnection(userId);

      if (!connection) {
        return NextResponse.json(
          {
            error:
              'Reddit account not connected. Please connect your Reddit account first.',
          },
          { status: 400 }
        );
      }

      const credentials = toCredentials(connection);
      if (!credentials) {
        return NextResponse.json({ error: RECONNECT_ERROR }, { status: 400 });
      }

      // Create Reddit service via factory (handles initialization + token refresh)
      const redditService = createPlatformService('reddit', credentials, {
        connectionId: connection.id,
      });

      if (!redditService) {
        return NextResponse.json(
          { error: 'Reddit service unavailable' },
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
          platform: 'reddit',
          content: postData.content || postData.title,
          scheduledTime: new Date(postData.scheduledAt),
          mediaUrls: postData.url ? [postData.url] : [],
          metadata: {
            title: postData.title,
            subreddit: postData.subreddit,
            kind: postData.kind,
            flair_id: postData.flair_id,
            flair_text: postData.flair_text,
            nsfw: postData.nsfw,
            spoiler: postData.spoiler,
          },
        });

        await auditLogger.logData(
          'create',
          'scheduled_post',
          scheduled.id,
          userId,
          'success',
          {
            action: 'reddit_post_scheduled',
            scheduledTime: postData.scheduledAt,
            subreddit: postData.subreddit,
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

      // Create the Reddit post
      const result = await redditService.createPost({
        text: postData.content || '',
        mediaUrls: postData.url ? [postData.url] : undefined,
        linkUrl: postData.url,
        metadata: {
          title: postData.title,
          subreddit: postData.subreddit,
          kind: postData.kind,
          flair_id: postData.flair_id,
          flair_text: postData.flair_text,
          nsfw: postData.nsfw,
          spoiler: postData.spoiler,
        },
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create Reddit post' },
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
              content: postData.content || postData.title,
              mediaUrls: postData.url ? [postData.url] : [],
              status: 'published',
              publishedAt: new Date(),
              metadata: {
                title: postData.title,
                subreddit: postData.subreddit,
                kind: postData.kind,
                permalink: result.url ?? null,
                source: 'api/social/reddit/post',
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
          action: 'reddit_post_created',
          subreddit: postData.subreddit,
          kind: postData.kind,
          hasUrl: !!postData.url,
          usageFeature: 'reddit_post',
          usageCount: 1,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          id: result.postId,
          url: result.url,
          subreddit: postData.subreddit,
          title: postData.title,
        },
        recorded: Boolean(savedPost),
        usage: USAGE_NOT_PROVISIONED,
      });
    } catch (error: unknown) {
      logger.error('Reddit post error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      return NextResponse.json(
        {
          error: 'Failed to post to Reddit',
          message: errorMessage,
        },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/social/reddit/post
 * Get user's Reddit posts with optional sync and subreddit listing
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
    const listSubreddits = searchParams.get('subreddits') === 'true';

    // Get user's Reddit connection
    const connection = await findRedditConnection(userId);

    if (!connection) {
      return NextResponse.json(
        { error: 'Reddit account not connected' },
        { status: 400 }
      );
    }

    const credentials = toCredentials(connection);
    if (!credentials) {
      return NextResponse.json({ error: RECONNECT_ERROR }, { status: 400 });
    }

    // Create service via factory
    const service = createPlatformService('reddit', credentials, {
      connectionId: connection.id,
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Reddit service unavailable' },
        { status: 500 }
      );
    }

    const redditService = service as InstanceType<typeof RedditService>;

    // If subreddits listing requested, return subreddits
    if (listSubreddits) {
      const subreddits = await redditService.getSubreddits();

      return NextResponse.json({
        success: true,
        data: subreddits,
      });
    }

    // If sync requested, fetch from Reddit API
    if (syncFromPlatform) {
      const syncResult = await redditService.syncPosts(limit, cursor);

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
    });
  } catch (error: unknown) {
    logger.error('Get Reddit posts error:', error);
    const errorMessage = 'An unexpected error occurred. Please try again.';
    return NextResponse.json(
      { error: 'Failed to get Reddit posts', message: errorMessage },
      { status: 500 }
    );
  }
}
