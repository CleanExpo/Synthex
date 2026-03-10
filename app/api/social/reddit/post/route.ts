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
import { createPlatformService, RedditService } from '@/lib/social';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Request validation schema — title and subreddit are REQUIRED for Reddit posts
const PostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title must be 300 characters or less'),
  content: z.string().max(40000, 'Content must be 40,000 characters or less').optional(),
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
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'reddit')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Reddit account not connected. Please connect your Reddit account first.' },
        { status: 400 }
      );
    }

    // Create Reddit service via factory (handles initialization + token refresh)
    const redditService = createPlatformService('reddit', {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    if (!redditService) {
      return NextResponse.json(
        { error: 'Reddit service unavailable' },
        { status: 500 }
      );
    }

    // Handle scheduled posts
    if (postData.scheduledAt) {
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'reddit',
          content: postData.content || postData.title,
          media_urls: postData.url ? [postData.url] : [],
          scheduled_time: postData.scheduledAt,
          metadata: {
            title: postData.title,
            subreddit: postData.subreddit,
            kind: postData.kind,
            flair_id: postData.flair_id,
            flair_text: postData.flair_text,
            nsfw: postData.nsfw,
            spoiler: postData.spoiler,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (scheduleError) {
        throw scheduleError;
      }

      await auditLogger.logData(
        'create',
        'scheduled_post',
        scheduledPost.id,
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
          id: scheduledPost.id,
          scheduledTime: postData.scheduledAt,
          status: 'pending',
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

    // Save post to database
    const { data: savedPost } = await supabase
      .from('social_posts')
      .insert({
        user_id: userId,
        platform: 'reddit',
        content: postData.content || postData.title,
        post_id: result.postId,
        media_urls: postData.url ? [postData.url] : [],
        status: 'published',
        metrics: {},
        metadata: {
          title: postData.title,
          subreddit: postData.subreddit,
          kind: postData.kind,
          permalink: result.url,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'reddit_post',
      count: 1,
      timestamp: new Date().toISOString(),
    });

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
    });
  } catch (error: unknown) {
    logger.error('Reddit post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to post to Reddit',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
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
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'reddit')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Reddit account not connected' },
        { status: 400 }
      );
    }

    // Create service via factory
    const service = createPlatformService('reddit', {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
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
          await supabase
            .from('social_posts')
            .upsert({
              user_id: userId,
              platform: 'reddit',
              post_id: post.platformId,
              content: post.content,
              media_urls: post.mediaUrls,
              metrics: post.metrics,
              published_at: post.publishedAt.toISOString(),
              status: 'published',
            }, {
              onConflict: 'user_id,platform,post_id',
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

    // Get posts from database
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'reddit')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: posts,
    });
  } catch (error: unknown) {
    logger.error('Get Reddit posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get Reddit posts', message: errorMessage },
      { status: 500 }
    );
  }
}
