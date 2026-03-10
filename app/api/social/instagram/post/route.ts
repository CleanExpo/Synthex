/**
 * Instagram Posting API
 *
 * @description Post content to Instagram via Facebook Graph API
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_APP_ID: Facebook app ID (SECRET)
 * - FACEBOOK_APP_SECRET: Facebook app secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InstagramService } from '@/lib/social/instagram-service';
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
  caption: z.string().max(2200, 'Caption must be 2200 characters or less'),
  mediaUrls: z.array(z.string().url()).min(1, 'At least one media URL is required'),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'REELS', 'STORIES']).default('IMAGE'),
  scheduledTime: z.string().datetime().optional(),
  location: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  hashtags: z.array(z.string()).optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/instagram/post
 * Create a new Instagram post
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

    // Get user's Instagram connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Instagram account not connected. Please connect your Instagram Business account first.' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Instagram connection expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Initialize Instagram service with user credentials
    const instagramService = new InstagramService();
    instagramService.initialize({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    // Validate credentials
    const isValid = await instagramService.validateCredentials();
    if (!isValid) {
      return NextResponse.json(
        { error: 'Instagram credentials are invalid. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Handle scheduled posts
    if (postData.scheduledTime) {
      const scheduleDate = new Date(postData.scheduledTime);

      // Save to database for later processing
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'instagram',
          content: postData.caption,
          media_urls: postData.mediaUrls,
          media_type: postData.mediaType,
          scheduled_time: postData.scheduledTime,
          metadata: {
            location: postData.location,
            hashtags: postData.hashtags,
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
          action: 'instagram_post_scheduled',
          scheduledTime: postData.scheduledTime,
          mediaType: postData.mediaType,
        }
      );

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          id: scheduledPost.id,
          scheduledTime: postData.scheduledTime,
          status: 'pending',
        },
      });
    }

    // Build caption with hashtags
    let fullCaption = postData.caption;
    if (postData.hashtags && postData.hashtags.length > 0) {
      const hashtagString = postData.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      fullCaption = `${postData.caption}\n\n${hashtagString}`;
    }

    // Create the post
    const result = await instagramService.createPost({
      text: fullCaption,
      mediaUrls: postData.mediaUrls,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create Instagram post' },
        { status: 500 }
      );
    }

    // Save post to database
    const { data: savedPost } = await supabase
      .from('social_posts')
      .insert({
        user_id: userId,
        platform: 'instagram',
        content: fullCaption,
        post_id: result.postId,
        media_urls: postData.mediaUrls,
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
      feature: 'instagram_post',
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
        action: 'instagram_post_created',
        mediaType: postData.mediaType,
        hasLocation: !!postData.location,
        hashtagCount: postData.hashtags?.length || 0,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.postId,
        url: result.url,
        caption: fullCaption,
        mediaType: postData.mediaType,
      },
    });
  } catch (error: unknown) {
    logger.error('Instagram post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to post to Instagram',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/instagram/post
 * Get user's Instagram posts
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

    // Get user's Instagram connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Instagram account not connected' },
        { status: 400 }
      );
    }

    // If sync requested, fetch from Instagram API
    if (syncFromPlatform) {
      const instagramService = new InstagramService();
      instagramService.initialize({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
        platformUserId: connection.platform_user_id,
        platformUsername: connection.platform_username,
      });

      const syncResult = await instagramService.syncPosts(limit, cursor);

      if (syncResult.success) {
        // Update database with synced posts
        for (const post of syncResult.posts) {
          await supabase
            .from('social_posts')
            .upsert({
              user_id: userId,
              platform: 'instagram',
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
      .eq('platform', 'instagram')
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
    logger.error('Get Instagram posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get Instagram posts', message: errorMessage },
      { status: 500 }
    );
  }
}
