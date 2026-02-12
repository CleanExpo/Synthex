/**
 * YouTube Posting API
 *
 * @description Upload videos and manage content via YouTube Data API v3
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
import jwt from 'jsonwebtoken';
import { auditLogger } from '@/lib/security/audit-logger';

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
type CommunityPost = z.infer<typeof CommunityPostSchema>;

async function makeYouTubeRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${YOUTUBE_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `YouTube API error: ${response.status}`);
  }

  return data;
}

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
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId?: string; id?: string };
      userId = decoded.userId || decoded.id || '';
      if (!userId) throw new Error('No user ID in token');
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
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
      const scheduledDate = new Date(videoData.scheduledTime);

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

    // Initiate resumable upload
    // Step 1: Start resumable upload session
    const uploadUrl = `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`;

    const videoMetadata = {
      snippet: {
        title: videoData.title,
        description: videoData.description || '',
        tags: videoData.tags || [],
        categoryId: videoData.categoryId,
      },
      status: {
        privacyStatus: videoData.privacy,
        selfDeclaredMadeForKids: videoData.madeForKids,
      },
    };

    // Initialize upload session
    const initResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(videoMetadata),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || 'Failed to initialize upload');
    }

    const resumableUri = initResponse.headers.get('location');

    if (!resumableUri) {
      throw new Error('Failed to get upload URI from YouTube');
    }

    // For URL-based uploads, we need to fetch the video and upload it
    // This is a simplified version - production would use chunked uploads
    const videoResponse = await fetch(videoData.videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video from provided URL');
    }

    const videoBuffer = await videoResponse.arrayBuffer();

    // Upload the video
    const uploadResponse = await fetch(resumableUri, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'video/*',
        'Content-Length': videoBuffer.byteLength.toString(),
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error?.message || 'Failed to upload video');
    }

    const uploadResult = await uploadResponse.json();
    const videoId = uploadResult.id;

    // Add to playlist if specified
    if (videoData.playlistId && videoId) {
      try {
        await makeYouTubeRequest(
          '/playlistItems?part=snippet',
          connection.access_token,
          {
            method: 'POST',
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
      } catch (playlistError) {
        console.error('Failed to add video to playlist:', playlistError);
      }
    }

    // Set custom thumbnail if provided
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
        console.error('Failed to set thumbnail:', thumbnailError);
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
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoData.title,
        status: uploadResult.status?.uploadStatus || 'uploaded',
      },
    });
  } catch (error: unknown) {
    console.error('YouTube post error:', error);
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

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId?: string; id?: string };
      userId = decoded.userId || decoded.id || '';
      if (!userId) throw new Error('No user ID in token');
    } catch {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
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
        // YouTube API response types
        interface YouTubeChannelResponse {
          items?: Array<{
            contentDetails?: {
              relatedPlaylists?: { uploads?: string };
            };
          }>;
        }
        interface YouTubePlaylistItem {
          contentDetails: { videoId: string };
          snippet: {
            title: string;
            description: string;
            publishedAt: string;
            thumbnails?: { high?: { url: string } };
          };
        }
        interface YouTubePlaylistResponse {
          items?: YouTubePlaylistItem[];
        }
        interface YouTubeVideoStats {
          id: string;
          statistics: {
            viewCount?: string;
            likeCount?: string;
            commentCount?: string;
          };
        }
        interface YouTubeStatsResponse {
          items?: YouTubeVideoStats[];
        }

        // Get channel's uploads playlist
        const channelResponse = await makeYouTubeRequest<YouTubeChannelResponse>(
          '/channels?part=contentDetails&mine=true',
          connection.access_token
        );

        const uploadsPlaylistId = channelResponse.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (uploadsPlaylistId) {
          // Get videos from uploads playlist
          const videosResponse = await makeYouTubeRequest<YouTubePlaylistResponse>(
            `/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${limit}`,
            connection.access_token
          );

          // Get video statistics
          const videoIds = videosResponse.items?.map((item: YouTubePlaylistItem) => item.contentDetails.videoId).join(',');
          const statsResponse = await makeYouTubeRequest<YouTubeStatsResponse>(
            `/videos?part=statistics&id=${videoIds}`,
            connection.access_token
          );

          const statsMap = new Map(
            statsResponse.items?.map((item: YouTubeVideoStats) => [item.id, item.statistics]) || []
          );

          const videos = (videosResponse.items || []).map((item: YouTubePlaylistItem) => {
            const stats = (statsMap.get(item.contentDetails.videoId) || {}) as {
              viewCount?: string;
              likeCount?: string;
              commentCount?: string;
            };
            return {
              id: item.contentDetails.videoId,
              platformId: item.contentDetails.videoId,
              content: item.snippet.title,
              description: item.snippet.description,
              publishedAt: new Date(item.snippet.publishedAt),
              url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
              thumbnail: item.snippet.thumbnails?.high?.url,
              metrics: {
                views: parseInt(stats.viewCount || '0', 10),
                likes: parseInt(stats.likeCount || '0', 10),
                comments: parseInt(stats.commentCount || '0', 10),
              },
            };
          });

          return NextResponse.json({
            success: true,
            data: videos,
            synced: true,
          });
        }
      } catch (syncError) {
        console.error('YouTube sync error:', syncError);
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
    console.error('Get YouTube posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get YouTube videos', message: errorMessage },
      { status: 500 }
    );
  }
}
