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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { auditLogger } from '@/lib/security/audit-logger';
import { createPlatformService } from '@/lib/social';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Request validation schema
const PostRequestSchema = z.object({
  videoUrl: z.string().url('Valid video URL required'),
  caption: z.string().max(2200, 'Caption must be 2200 characters or less').optional(),
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
function mapPrivacyToVisibility(privacy: string): 'public' | 'connections' | 'private' {
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

    // Get user's TikTok connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'TikTok account not connected. Please connect your TikTok account first.' },
        { status: 400 }
      );
    }

    // Handle scheduled posts
    if (postData.scheduledTime) {
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'tiktok',
          content: postData.caption || '',
          media_urls: [postData.videoUrl],
          scheduled_time: postData.scheduledTime,
          metadata: {
            privacy: postData.privacy,
            disableComment: postData.disableComment,
            disableDuet: postData.disableDuet,
            disableStitch: postData.disableStitch,
            hashtags: postData.hashtags,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      await auditLogger.logData(
        'create',
        'scheduled_post',
        scheduledPost.id,
        userId,
        'success',
        { action: 'tiktok_post_scheduled', scheduledTime: postData.scheduledTime }
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
    let fullCaption = postData.caption || '';
    if (postData.hashtags && postData.hashtags.length > 0) {
      const hashtagString = postData.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      fullCaption = fullCaption ? `${fullCaption} ${hashtagString}` : hashtagString;
    }

    // Create TikTok service via factory
    const service = createPlatformService('tiktok', {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
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

    // Save post to database (status will be updated via webhook)
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform: 'tiktok',
      content: fullCaption,
      post_id: publishId,
      media_urls: [postData.videoUrl],
      media_type: 'VIDEO',
      status: 'processing', // TikTok processes async
      metrics: {},
      created_at: new Date().toISOString(),
    }).select().single();

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'tiktok_post',
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await auditLogger.logData(
      'create',
      'social_post',
      publishId || '',
      userId,
      'success',
      { action: 'tiktok_post_initiated', privacy: postData.privacy }
    );

    return NextResponse.json({
      success: true,
      data: {
        publishId,
        status: 'processing',
        message: 'Video upload initiated. TikTok will process the video.',
        caption: fullCaption,
      },
    });
  } catch (error: unknown) {
    logger.error('TikTok post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to post to TikTok', message: errorMessage },
      { status: 500 }
    );
  }
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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const syncFromPlatform = searchParams.get('sync') === 'true';

    const { data: connection } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .eq('is_active', true)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'TikTok account not connected' }, { status: 400 });
    }

    if (syncFromPlatform) {
      // Use TikTok service to sync posts from platform
      try {
        const service = createPlatformService('tiktok', {
          accessToken: connection.access_token,
          refreshToken: connection.refresh_token,
          expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
          platformUserId: connection.platform_user_id,
        });

        if (service) {
          const syncResult = await service.syncPosts(limit);

          if (syncResult.success) {
            // Map to the existing response format to preserve API contract
            const videos = syncResult.posts.map((post) => ({
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
      } catch (syncError) {
        logger.error('TikTok sync error:', syncError);
        // Fall through to database query
      }
    }

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, data: posts });
  } catch (error: unknown) {
    logger.error('Get TikTok posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get TikTok posts', message: errorMessage },
      { status: 500 }
    );
  }
}
