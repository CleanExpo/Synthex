/**
 * Pinterest Posting API
 *
 * @description Create and retrieve Pinterest pins via Pinterest API v5
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - PINTEREST_APP_ID: Pinterest app ID (SECRET)
 * - PINTEREST_APP_SECRET: Pinterest app secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PinterestService } from '@/lib/social/pinterest-service';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { auditLogger } from '@/lib/security/audit-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Request validation schema — boardId is REQUIRED for Pinterest pins
const PostRequestSchema = z.object({
  content: z.string().max(500, 'Description must be 500 characters or less'),
  mediaUrls: z.array(z.string().url()).optional(),
  boardId: z.string().min(1, 'Board ID is required for Pinterest pins'),
  title: z.string().max(100).optional(),
  link: z.string().url().optional(),
  altText: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/pinterest/post
 * Create a new Pinterest pin
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

    // Get user's Pinterest connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'pinterest')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Pinterest account not connected. Please connect your Pinterest account first.' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Pinterest connection expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Initialize Pinterest service with user credentials
    const pinterestService = new PinterestService();
    pinterestService.initialize({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    // Handle scheduled posts
    if (postData.scheduledAt) {
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'pinterest',
          content: postData.content,
          media_urls: postData.mediaUrls || [],
          scheduled_time: postData.scheduledAt,
          metadata: {
            boardId: postData.boardId,
            title: postData.title,
            link: postData.link,
            altText: postData.altText,
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
          action: 'pinterest_post_scheduled',
          scheduledTime: postData.scheduledAt,
          boardId: postData.boardId,
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

    // Create the pin
    const result = await pinterestService.createPost({
      text: postData.content,
      mediaUrls: postData.mediaUrls,
      linkUrl: postData.link,
      metadata: {
        boardId: postData.boardId,
        title: postData.title,
        link: postData.link,
        altText: postData.altText,
      },
    } as Parameters<typeof pinterestService.createPost>[0] & { metadata: Record<string, unknown> });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create Pinterest pin' },
        { status: 500 }
      );
    }

    // Save post to database
    const { data: savedPost } = await supabase
      .from('social_posts')
      .insert({
        user_id: userId,
        platform: 'pinterest',
        content: postData.content,
        post_id: result.postId,
        media_urls: postData.mediaUrls || [],
        status: 'published',
        metrics: {},
        metadata: {
          boardId: postData.boardId,
          title: postData.title,
          link: postData.link,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'pinterest_post',
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
        action: 'pinterest_pin_created',
        boardId: postData.boardId,
        hasMedia: !!(postData.mediaUrls && postData.mediaUrls.length > 0),
        hasLink: !!postData.link,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.postId,
        url: result.url,
        boardId: postData.boardId,
        title: postData.title,
      },
    });
  } catch (error: unknown) {
    console.error('Pinterest post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to post to Pinterest',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/pinterest/post
 * Get user's Pinterest pins with optional sync and board listing
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

    // Get user's Pinterest connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'pinterest')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Pinterest account not connected' },
        { status: 400 }
      );
    }

    // Initialize service for sync and boards
    const pinterestService = new PinterestService();
    pinterestService.initialize({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    // If sync requested, fetch from Pinterest API
    if (syncFromPlatform) {
      const syncResult = await pinterestService.syncPosts(limit, cursor);

      if (syncResult.success) {
        // Update database with synced posts
        for (const post of syncResult.posts) {
          await supabase
            .from('social_posts')
            .upsert({
              user_id: userId,
              platform: 'pinterest',
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

        // Also fetch boards for metadata
        const boards = await pinterestService.getBoards();

        return NextResponse.json({
          success: true,
          data: syncResult.posts,
          hasMore: syncResult.hasMore,
          cursor: syncResult.cursor,
          synced: true,
          metadata: {
            boards,
          },
        });
      }
    }

    // Get posts from database
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'pinterest')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Also fetch boards for metadata
    const boards = await pinterestService.getBoards();

    return NextResponse.json({
      success: true,
      data: posts,
      metadata: {
        boards,
      },
    });
  } catch (error: unknown) {
    console.error('Get Pinterest posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get Pinterest posts', message: errorMessage },
      { status: 500 }
    );
  }
}
