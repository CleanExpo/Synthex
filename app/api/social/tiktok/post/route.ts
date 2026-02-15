/**
 * TikTok Posting API
 *
 * @description Post videos to TikTok via TikTok Marketing API
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

/** TikTok video data from API response */
interface TikTokVideo {
  id: string;
  title?: string;
  video_description?: string;
  create_time: number;
  share_url: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

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

async function makeTikTokRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${TIKTOK_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || data.error?.code) {
    throw new Error(data.error?.message || `TikTok API error: ${response.status}`);
  }

  return data;
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

    // Step 1: Initialize video upload
    const initResponse = await makeTikTokRequest<any>(
      '/post/publish/video/init/',
      connection.access_token,
      {
        method: 'POST',
        body: JSON.stringify({
          post_info: {
            title: fullCaption,
            privacy_level: postData.privacy,
            disable_comment: postData.disableComment,
            disable_duet: postData.disableDuet,
            disable_stitch: postData.disableStitch,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: postData.videoUrl,
          },
        }),
      }
    );

    const publishId = initResponse.data?.publish_id;

    if (!publishId) {
      return NextResponse.json(
        { error: 'Failed to initialize TikTok video upload' },
        { status: 500 }
      );
    }

    // Save post to database (status will be updated via webhook)
    const { data: savedPost } = await supabase.from('social_posts').insert({
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
      publishId,
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
    console.error('TikTok post error:', error);
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
      // Fetch videos from TikTok API
      try {
        const videosResponse = await makeTikTokRequest<any>(
          '/video/list/?fields=id,title,video_description,create_time,share_url,like_count,comment_count,share_count,view_count',
          connection.access_token,
          { method: 'POST', body: JSON.stringify({ max_count: limit }) }
        );

        const videos = ((videosResponse.data?.videos || []) as TikTokVideo[]).map((video) => ({
          id: video.id,
          platformId: video.id,
          content: video.video_description || video.title,
          publishedAt: new Date(video.create_time * 1000),
          url: video.share_url,
          metrics: {
            likes: video.like_count || 0,
            comments: video.comment_count || 0,
            shares: video.share_count || 0,
            views: video.view_count || 0,
          },
        }));

        return NextResponse.json({
          success: true,
          data: videos,
          synced: true,
        });
      } catch (syncError) {
        console.error('TikTok sync error:', syncError);
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
    console.error('Get TikTok posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get TikTok posts', message: errorMessage },
      { status: 500 }
    );
  }
}
