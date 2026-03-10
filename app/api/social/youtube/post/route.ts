/**
 * YouTube Posting API
 *
 * @description Upload videos and manage content via YouTube Data API v3
 * Uses YouTubeService from lib/social for core platform operations.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (SECRET)
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret (SECRET)
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

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

// Request validation schema
const VideoUploadSchema = z.object({
  title: z.string().min(1).max(100, 'Title must be 100 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
  videoUrl: z.string().url('Valid video URL required'),
  tags: z.array(z.string().max(500)).max(500).optional(),
  categoryId: z.string().default('22'), // Default: People & Blogs
  privacy: z.enum(['public', 'private', 'unlisted']).default('public'),
  madeForKids: z.boolean().default(false),
  scheduledTime: z.string().datetime().optional(),
  playlistId: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
});

const CommunityPostSchema = z.object({
  text: z.string().min(1).max(500, 'Community post must be 500 characters or less'),
  imageUrl: z.string().url().optional(),
});

type VideoUpload = z.infer<typeof VideoUploadSchema>;

/**
 * POST /api/social/youtube/post
 * Upload a video or create a community post
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

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const postType = searchParams.get('type') || 'video';

    // Get user's YouTube connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'YouTube account not connected. Please connect your YouTube channel first.' },
        { status: 400 }
      );
    }

    // Handle community post
    if (postType === 'community') {
      const validation = CommunityPostSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      // Note: YouTube Community Posts API has limited availability
      // This is a placeholder for when the API becomes more accessible
      return NextResponse.json(
        { error: 'Community posts are currently only available through YouTube Studio' },
        { status: 501 }
      );
    }

    // Handle video upload
    const validation = VideoUploadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const videoData: VideoUpload = validation.data;

    // Handle scheduled uploads
    if (videoData.scheduledTime) {
      // Save to database for processing
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'youtube',
          content: `${videoData.title}\n\n${videoData.description || ''}`,
          media_urls: [videoData.videoUrl],
          scheduled_time: videoData.scheduledTime,
          metadata: {
            title: videoData.title,
            description: videoData.description,
            tags: videoData.tags,
            categoryId: videoData.categoryId,
            privacy: videoData.privacy,
            madeForKids: videoData.madeForKids,
            playlistId: videoData.playlistId,
            thumbnailUrl: videoData.thumbnailUrl,
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
        { action: 'youtube_video_scheduled', scheduledTime: videoData.scheduledTime }
      );

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          id: scheduledPost.id,
          scheduledTime: videoData.scheduledTime,
          status: 'pending',
        },
      });
    }

    // Use YouTubeService for video upload
    const service = createPlatformService('youtube', {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
    });

    if (!service) {
      throw new Error('Failed to initialize YouTube service');
    }

    // Map privacy for visibility
    const visibilityMap: Record<string, 'public' | 'private' | 'connections'> = {
      public: 'public',
      private: 'private',
      unlisted: 'connections',
    };

    const result = await service.createPost({
      text: videoData.title + (videoData.description ? `\n\n${videoData.description}` : ''),
      mediaUrls: [videoData.videoUrl],
      visibility: visibilityMap[videoData.privacy] || 'public',
    });

    if (!result.success || !result.postId) {
      throw new Error(result.error || 'Failed to upload video');
    }

    const videoId = result.postId;

    // Add to playlist if specified (YouTube-specific, not in base service)
    if (videoData.playlistId && videoId) {
      try {
        const playlistResponse = await fetch(
          `${YOUTUBE_API_BASE}/playlistItems?part=snippet`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: {
                playlistId: videoData.playlistId,
                resourceId: {
                  kind: 'youtube#video',
                  videoId: videoId,
                },
              },
            }),
          }
        );

        if (!playlistResponse.ok) {
          logger.error('Failed to add video to playlist:', await playlistResponse.text());
        }
      } catch (playlistError) {
        logger.error('Failed to add video to playlist:', playlistError);
      }
    }

    // Set custom thumbnail if provided (YouTube-specific, not in base service)
    if (videoData.thumbnailUrl && videoId) {
      try {
        const thumbnailResponse = await fetch(videoData.thumbnailUrl);
        const thumbnailBuffer = await thumbnailResponse.arrayBuffer();

        await fetch(
          `${YOUTUBE_UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'Content-Type': 'image/jpeg',
            },
            body: thumbnailBuffer,
          }
        );
      } catch (thumbnailError) {
        logger.error('Failed to set thumbnail:', thumbnailError);
      }
    }

    // Save to database
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform: 'youtube',
      content: `${videoData.title}\n\n${videoData.description || ''}`,
      post_id: videoId,
      media_urls: [videoData.videoUrl],
      media_type: 'VIDEO',
      status: 'published',
      metrics: {},
      created_at: new Date().toISOString(),
    });

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'youtube_upload',
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await auditLogger.logData(
      'create',
      'social_post',
      videoId,
      userId,
      'success',
      { action: 'youtube_video_uploaded', privacy: videoData.privacy, categoryId: videoData.categoryId }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: videoId,
        url: result.url || `https://www.youtube.com/watch?v=${videoId}`,
        title: videoData.title,
        status: 'uploaded',
      },
    });
  } catch (error: unknown) {
    logger.error('YouTube post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to post to YouTube', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/youtube/post
 * Get user's YouTube videos
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
      .eq('platform', 'youtube')
      .eq('is_active', true)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'YouTube account not connected' }, { status: 400 });
    }

    if (syncFromPlatform) {
      try {
        // Use YouTubeService for syncing posts from platform
        const service = createPlatformService('youtube', {
          accessToken: connection.access_token,
          refreshToken: connection.refresh_token,
          expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
          platformUserId: connection.platform_user_id,
        });

        if (service) {
          const syncResult = await service.syncPosts(limit);

          if (syncResult.success) {
            // Map to the existing response format for backward compatibility
            const videos = syncResult.posts.map((post) => ({
              id: post.id,
              platformId: post.platformId,
              content: post.content,
              description: post.content,
              publishedAt: post.publishedAt,
              url: post.url,
              thumbnail: post.mediaUrls?.[0],
              metrics: {
                views: post.metrics.impressions || 0,
                likes: post.metrics.likes,
                comments: post.metrics.comments,
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
        logger.error('YouTube sync error:', syncError);
      }
    }

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, data: posts });
  } catch (error: unknown) {
    logger.error('Get YouTube posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get YouTube videos', message: errorMessage },
      { status: 500 }
    );
  }
}
