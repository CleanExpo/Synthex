/**
 * Facebook Posting API
 *
 * @description Post content to Facebook Pages via Facebook Graph API
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_APP_ID: Facebook app ID (SECRET)
 * - FACEBOOK_APP_SECRET: Facebook app secret (SECRET)
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

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/** Facebook Pages API response */
interface FacebookPagesResponse {
  data: Array<{
    id: string;
    access_token: string;
    name: string;
  }>;
}

/** Facebook post creation result */
interface FacebookPostResult {
  id?: string;
  post_id?: string;
}

/** Facebook post payload */
interface FacebookPostPayload {
  message: string;
  link?: string;
  published?: boolean;
  scheduled_publish_time?: number;
  attached_media?: Array<{ media_fbid: string }>;
}

/** Facebook posts list response */
interface FacebookPostsResponse {
  data: Array<{
    id: string;
    message?: string;
    created_time: string;
    permalink_url?: string;
    shares?: { count: number };
    reactions?: { summary?: { total_count: number } };
    comments?: { summary?: { total_count: number } };
  }>;
}

// Request validation schema
const PostRequestSchema = z.object({
  message: z.string().max(63206, 'Post must be 63,206 characters or less'),
  link: z.string().url().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  mediaType: z.enum(['photo', 'video', 'photos']).optional(),
  pageId: z.string().optional(), // If not provided, uses default page
  scheduledTime: z.string().datetime().optional(),
  targeting: z.object({
    geoLocations: z.array(z.string()).optional(),
    ageMin: z.number().min(13).max(65).optional(),
    ageMax: z.number().min(13).max(65).optional(),
  }).optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

async function makeFacebookRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${accessToken}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API error: ${response.status}`);
  }

  return data;
}

/**
 * POST /api/social/facebook/post
 * Create a new Facebook Page post
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

    // Get user's Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Facebook account not connected. Please connect your Facebook account first.' },
        { status: 400 }
      );
    }

    // Get the page to post to
    let pageId = postData.pageId;
    let pageAccessToken = connection.access_token;

    if (!pageId) {
      // Get user's pages and use the first one
      const pagesResponse = await makeFacebookRequest<FacebookPagesResponse>(
        '/me/accounts',
        connection.access_token
      );

      if (!pagesResponse.data || pagesResponse.data.length === 0) {
        return NextResponse.json(
          { error: 'No Facebook Pages found. Please ensure you have admin access to at least one Facebook Page.' },
          { status: 400 }
        );
      }

      pageId = pagesResponse.data[0].id;
      pageAccessToken = pagesResponse.data[0].access_token;
    } else {
      // Get access token for specific page
      const pagesResponse = await makeFacebookRequest<FacebookPagesResponse>(
        '/me/accounts',
        connection.access_token
      );
      const page = pagesResponse.data?.find((p) => p.id === pageId);
      if (!page) {
        return NextResponse.json(
          { error: 'You do not have access to this Facebook Page.' },
          { status: 403 }
        );
      }
      pageAccessToken = page.access_token;
    }

    // Handle scheduled posts
    if (postData.scheduledTime) {
      const scheduledTimestamp = Math.floor(new Date(postData.scheduledTime).getTime() / 1000);

      // Facebook requires scheduled posts to be at least 10 minutes in future
      const minScheduleTime = Math.floor(Date.now() / 1000) + 600;
      if (scheduledTimestamp < minScheduleTime) {
        return NextResponse.json(
          { error: 'Scheduled time must be at least 10 minutes in the future.' },
          { status: 400 }
        );
      }

      // Create scheduled post directly on Facebook
      const postPayload: FacebookPostPayload = {
        message: postData.message,
        published: false,
        scheduled_publish_time: scheduledTimestamp,
      };

      if (postData.link) {
        postPayload.link = postData.link;
      }

      const result = await makeFacebookRequest<FacebookPostResult>(
        `/${pageId}/feed`,
        pageAccessToken,
        {
          method: 'POST',
          body: JSON.stringify(postPayload),
        }
      );

      // Save to database
      await supabase.from('scheduled_posts').insert({
        user_id: userId,
        platform: 'facebook',
        content: postData.message,
        post_id: result.id,
        link_url: postData.link,
        media_urls: postData.mediaUrls,
        scheduled_time: postData.scheduledTime,
        metadata: { pageId },
        status: 'pending',
      });

      await auditLogger.logData(
        'create',
        'scheduled_post',
        result.id,
        userId,
        'success',
        { action: 'facebook_post_scheduled', scheduledTime: postData.scheduledTime, pageId }
      );

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          id: result.id,
          scheduledTime: postData.scheduledTime,
          status: 'scheduled',
        },
      });
    }

    // Create immediate post
    let result: FacebookPostResult;

    if (postData.mediaUrls && postData.mediaUrls.length > 0) {
      if (postData.mediaType === 'video' || postData.mediaUrls[0].match(/\.(mp4|mov|avi)$/i)) {
        // Video post
        result = await makeFacebookRequest<FacebookPostResult>(
          `/${pageId}/videos`,
          pageAccessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              file_url: postData.mediaUrls[0],
              description: postData.message,
            }),
          }
        );
      } else if (postData.mediaUrls.length > 1 || postData.mediaType === 'photos') {
        // Multi-photo post - upload each photo first
        const photoIds: string[] = [];
        for (const photoUrl of postData.mediaUrls) {
          const photoResult = await makeFacebookRequest<FacebookPostResult>(
            `/${pageId}/photos`,
            pageAccessToken,
            {
              method: 'POST',
              body: JSON.stringify({
                url: photoUrl,
                published: false,
              }),
            }
          );
          if (photoResult.id) {
            photoIds.push(photoResult.id);
          }
        }

        // Create post with attached photos
        const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
        result = await makeFacebookRequest<FacebookPostResult>(
          `/${pageId}/feed`,
          pageAccessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              message: postData.message,
              attached_media: attachedMedia,
            }),
          }
        );
      } else {
        // Single photo post
        result = await makeFacebookRequest<FacebookPostResult>(
          `/${pageId}/photos`,
          pageAccessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              url: postData.mediaUrls[0],
              message: postData.message,
            }),
          }
        );
      }
    } else {
      // Text/link post
      const postPayload: FacebookPostPayload = { message: postData.message };
      if (postData.link) {
        postPayload.link = postData.link;
      }

      result = await makeFacebookRequest<FacebookPostResult>(
        `/${pageId}/feed`,
        pageAccessToken,
        {
          method: 'POST',
          body: JSON.stringify(postPayload),
        }
      );
    }

    // Save post to database
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform: 'facebook',
      content: postData.message,
      post_id: result.id || result.post_id,
      link_url: postData.link,
      media_urls: postData.mediaUrls,
      status: 'published',
      metrics: {},
      created_at: new Date().toISOString(),
    });

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'facebook_post',
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await auditLogger.logData(
      'create',
      'social_post',
      result.id || result.post_id,
      userId,
      'success',
      { action: 'facebook_post_created', pageId, hasMedia: !!postData.mediaUrls?.length }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.id || result.post_id,
        url: `https://www.facebook.com/${result.id || result.post_id}`,
        message: postData.message,
      },
    });
  } catch (error: unknown) {
    console.error('Facebook post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to post to Facebook', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/facebook/post
 * Get user's Facebook Page posts
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
    const pageId = searchParams.get('pageId');
    const syncFromPlatform = searchParams.get('sync') === 'true';

    const { data: connection } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'Facebook account not connected' }, { status: 400 });
    }

    if (syncFromPlatform && pageId) {
      // Fetch posts from Facebook API
      try {
        const postsResponse = await makeFacebookRequest<FacebookPostsResponse>(
          `/${pageId}/posts?fields=id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)&limit=${limit}`,
          connection.access_token
        );

        const posts = (postsResponse.data || []).map((post) => ({
          id: post.id,
          platformId: post.id,
          content: post.message || '',
          publishedAt: new Date(post.created_time),
          url: post.permalink_url,
          metrics: {
            likes: post.reactions?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            shares: post.shares?.count || 0,
          },
        }));

        return NextResponse.json({
          success: true,
          data: posts,
          synced: true,
        });
      } catch (syncError) {
        console.error('Facebook sync error:', syncError);
      }
    }

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, data: posts });
  } catch (error: unknown) {
    console.error('Get Facebook posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get Facebook posts', message: errorMessage },
      { status: 500 }
    );
  }
}
