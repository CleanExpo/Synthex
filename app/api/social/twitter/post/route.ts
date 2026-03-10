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
import { z } from 'zod';
import { twitterService } from '@/lib/social/twitter-service';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const twitterPostSchema = z.object({
  text: z.string().optional(),
  thread: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  scheduledTime: z.string().optional(),
});

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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Check user's subscription limits
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, metadata')
      .eq('user_id', userId)
      .single();

    // Get and validate request body
    const rawBody = await request.json();
    const validation = twitterPostSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { text, thread, mediaUrls, scheduledTime } = validation.data;

    if (!text && !thread) {
      return NextResponse.json(
        { error: 'Tweet text or thread is required' },
        { status: 400 }
      );
    }

    // Handle media uploads if provided
    const mediaIds: string[] = [];
    if (mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        try {
          const mediaId = await twitterService.uploadMedia(url);
          mediaIds.push(mediaId);
        } catch (error) {
          logger.error('Media upload failed:', error);
        }
      }
    }

    let result;

    // Handle scheduled posts
    if (scheduledTime) {
      const scheduleDate = new Date(scheduledTime);
      result = await twitterService.scheduleTweet(
        { text: text!, mediaIds },
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
      const tweetValidation = twitterService.validateTweet(text!);
      if (!tweetValidation.valid) {
        return NextResponse.json(
          { error: tweetValidation.error },
          { status: 400 }
        );
      }

      result = await twitterService.postTweet({
        text: text!,
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
    logger.error('Twitter post error:', error);
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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

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
            logger.error('Failed to update metrics:', error);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    logger.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to get Twitter posts' },
      { status: 500 }
    );
  }
}