/**
 * LinkedIn Posting API
 *
 * @description Post content to LinkedIn via LinkedIn Marketing API
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LINKEDIN_CLIENT_ID: LinkedIn app client ID (SECRET)
 * - LINKEDIN_CLIENT_SECRET: LinkedIn app client secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LinkedInService } from '@/lib/social/linkedin-service';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { auditLogger } from '@/lib/security/audit-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// Request validation schema
const PostRequestSchema = z.object({
  text: z.string().min(1).max(3000, 'Post must be 3000 characters or less'),
  linkUrl: z.string().url().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  visibility: z.enum(['public', 'connections']).default('public'),
  scheduledTime: z.string().datetime().optional(),
});

type PostRequest = z.infer<typeof PostRequestSchema>;

/**
 * POST /api/social/linkedin/post
 * Create a new LinkedIn post
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

    // Get user's LinkedIn connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'LinkedIn account not connected. Please connect your LinkedIn account first.' },
        { status: 400 }
      );
    }

    // Initialize LinkedIn service with user credentials
    const linkedInService = new LinkedInService();
    linkedInService.initialize({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      platformUserId: connection.platform_user_id,
      platformUsername: connection.platform_username,
    });

    // Handle scheduled posts
    if (postData.scheduledTime) {
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          platform: 'linkedin',
          content: postData.text,
          link_url: postData.linkUrl,
          media_urls: postData.mediaUrls,
          scheduled_time: postData.scheduledTime,
          metadata: { visibility: postData.visibility },
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
        { action: 'linkedin_post_scheduled', scheduledTime: postData.scheduledTime }
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

    // Create the post
    const result = await linkedInService.createPost({
      text: postData.text,
      linkUrl: postData.linkUrl,
      mediaUrls: postData.mediaUrls,
      visibility: postData.visibility,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create LinkedIn post' },
        { status: 500 }
      );
    }

    // Save post to database
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform: 'linkedin',
      content: postData.text,
      post_id: result.postId,
      link_url: postData.linkUrl,
      media_urls: postData.mediaUrls,
      status: 'published',
      metrics: {},
      created_at: new Date().toISOString(),
    });

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'linkedin_post',
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await auditLogger.logData(
      'create',
      'social_post',
      result.postId,
      userId,
      'success',
      { action: 'linkedin_post_created', visibility: postData.visibility, hasLink: !!postData.linkUrl }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.postId,
        url: result.url,
        text: postData.text,
      },
    });
  } catch (error: unknown) {
    console.error('LinkedIn post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to post to LinkedIn', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/linkedin/post
 * Get user's LinkedIn posts
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
      .eq('platform', 'linkedin')
      .eq('is_active', true)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'LinkedIn account not connected' }, { status: 400 });
    }

    if (syncFromPlatform) {
      const linkedInService = new LinkedInService();
      linkedInService.initialize({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined,
      });

      const syncResult = await linkedInService.syncPosts(limit);

      if (syncResult.success) {
        return NextResponse.json({
          success: true,
          data: syncResult.posts,
          hasMore: syncResult.hasMore,
          synced: true,
        });
      }
    }

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, data: posts });
  } catch (error: unknown) {
    console.error('Get LinkedIn posts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get LinkedIn posts', message: errorMessage },
      { status: 500 }
    );
  }
}
