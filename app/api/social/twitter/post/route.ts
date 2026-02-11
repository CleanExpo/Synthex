/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_API_KEY: Twitter API key (SECRET)
 * - TWITTER_API_SECRET: Twitter API secret (SECRET)
 * - TWITTER_ACCESS_TOKEN: Twitter access token (SECRET)
 * - TWITTER_ACCESS_SECRET: Twitter access token secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 * 
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { twitterService } from '@/lib/social/twitter-service';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      userId = decoded.userId || decoded.id;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Check user's subscription limits
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, metadata')
      .eq('user_id', userId)
      .single();

    // Get request body
    const body = await request.json();
    const { text, thread, mediaUrls, scheduledTime } = body;

    if (!text && !thread) {
      return NextResponse.json(
        { error: 'Tweet text or thread is required' },
        { status: 400 }
      );
    }

    // Handle media uploads if provided
    let mediaIds: string[] = [];
    if (mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        try {
          const mediaId = await twitterService.uploadMedia(url);
          mediaIds.push(mediaId);
        } catch (error) {
          console.error('Media upload failed:', error);
        }
      }
    }

    let result;

    // Handle scheduled posts
    if (scheduledTime) {
      const scheduleDate = new Date(scheduledTime);
      result = await twitterService.scheduleTweet(
        { text, mediaIds },
        scheduleDate
      );

      // Save to database for later processing
      await supabase.from('scheduled_posts').insert({
        user_id: userId,
        platform: 'twitter',
        content: text,
        media_ids: mediaIds,
        scheduled_time: scheduledTime,
        status: 'pending',
      });
    }
    // Handle thread posting
    else if (thread && Array.isArray(thread)) {
      // Validate all tweets in thread
      for (const tweet of thread) {
        const validation = twitterService.validateTweet(tweet);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400 }
          );
        }
      }

      result = await twitterService.postThread({
        tweets: thread,
        mediaIds: mediaIds.length > 0 ? [mediaIds] : undefined,
      });
    }
    // Handle single tweet
    else {
      // Validate tweet
      const validation = twitterService.validateTweet(text);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      result = await twitterService.postTweet({
        text,
        mediaIds,
      });
    }

    // Log the post
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform: 'twitter',
      content: text || thread?.join('\n'),
      post_id: result.id || null,
      status: 'published',
      metrics: {},
      created_at: new Date().toISOString(),
    });

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: 'twitter_post',
      count: thread ? thread.length : 1,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Twitter post error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to Twitter',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Get user's Twitter posts
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
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      userId = decoded.userId || decoded.id;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get posts from database
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'twitter')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Try to update metrics for recent posts
    for (const post of posts || []) {
      if (post.post_id && post.created_at) {
        const postAge = Date.now() - new Date(post.created_at).getTime();
        // Only update metrics for posts less than 7 days old
        if (postAge < 7 * 24 * 60 * 60 * 1000) {
          try {
            const metrics = await twitterService.getTweetMetrics(post.post_id);
            if (metrics) {
              await supabase
                .from('social_posts')
                .update({ metrics })
                .eq('id', post.id);
              post.metrics = metrics;
            }
          } catch (error) {
            console.error('Failed to update metrics:', error);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to get Twitter posts' },
      { status: 500 }
    );
  }
}