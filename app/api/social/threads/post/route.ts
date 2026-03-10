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
import { createPlatformService } from '@/lib/social';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Request validation schema
const PostRequestSchema = z.object({
  content: z.string().max(500, 'Thread text must be 500 characters or less'),
  mediaUrls: z.array(z.string().url()).optional(),
  mediaType: z.enum(['TEXT', 'IMAGE', 'VIDEO']).default('TEXT'),
  replyControl: z.enum(['everyone', 'accounts_you_follow', 'mentioned_only']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/threads/post
 * Create a new Threads post
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

    // Get user's Threads connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Threads account not connected. Please connect your Threads account first.' },
        { status: 400 }
      );
    }

    // Create Threads service via factory (handles initialization + token refresh)
    const threadsService = createPlatformService('threads', {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    if (!threadsService) {
      return NextResponse.json(
        { error: 'Threads service unavailable' },
        { status: 500 }
      );
    }

    // Handle scheduled posts
    if (postData.scheduledAt) {
      // Save to database for later processing
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'threads',
          content: postData.content,
          media_urls: postData.mediaUrls || [],
          media_type: postData.mediaType,
          scheduled_time: postData.scheduledAt,
          metadata: {
            replyControl: postData.replyControl,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (scheduleError) {
        throw scheduleError;
      }

      // Log the scheduled action
      await auditLogger.logData(
        'create',
        'scheduled_post',
        scheduledPost.id,
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
          id: scheduledPost.id,
          scheduledTime: postData.scheduledAt,
          status: 'pending',
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

    // Save post to database
    const { data: savedPost } = await supabase
      .from('social_posts')
      .insert({
        user_id: userId,
        platform: 'threads',
        content: postData.content,
        post_id: result.postId,
        media_urls: postData.mediaUrls || [],
        media_type: postData.mediaType,
        status: 'published',
        metrics: {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'threads_post',
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
        action: 'threads_post_created',
        mediaType: postData.mediaType,
        replyControl: postData.replyControl || 'everyone',
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
    });
  } catch (error: unknown) {
    logger.error('Threads post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to post to Threads',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
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
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'threads')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Threads account not connected' },
        { status: 400 }
      );
    }

    // If sync requested, fetch from Threads API
    if (syncFromPlatform) {
      const threadsService = createPlatformService('threads', {
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
        platformUserId: connection.platform_user_id,
        platformUsername: connection.platform_username,
      });

      const syncResult = threadsService
        ? await threadsService.syncPosts(limit, cursor)
        : { success: false, posts: [], total: 0, hasMore: false, error: 'Service unavailable' };

      if (syncResult.success) {
        // Update database with synced posts
        for (const post of syncResult.posts) {
          await supabase
            .from('social_posts')
            .upsert({
              user_id: userId,
              platform: 'threads',
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
      .eq('platform', 'threads')
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
    logger.error('Get Threads posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get Threads posts', message: errorMessage },
      { status: 500 }
    );
  }
}
