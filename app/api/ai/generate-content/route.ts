/**
 * AI Content Generation API Endpoint
 * Handles requests for AI-powered content creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiContentGenerator } from '@/lib/ai/content-generator';
import { authMonitor } from '@/lib/auth/monitoring';
import { logger } from '@/lib/logger';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { getUserAICredentials } from '@/lib/ai/api-credential-injector';

import { withRateLimit, UsageTracker } from '@/lib/middleware/rate-limiter';

const generateContentSchema = z.object({
  type: z.enum(['post', 'caption', 'thread', 'story', 'reel', 'article']).optional().default('post'),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'tiktok', 'facebook', 'youtube']),
  topic: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational', 'educational']).optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeEmojis: z.boolean().optional().default(true),
  includeHashtags: z.boolean().optional().default(true),
  includeCTA: z.boolean().optional().default(false),
  batchRequests: z.array(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return withRateLimit(request, async () => {
    try {
      // Verify authentication and extract user ID
      const authToken = request.cookies.get('auth-token')?.value;
      if (!authToken) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const tokenPayload = verifyTokenSafe(authToken);
      if (!tokenPayload?.userId) {
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
      const userId = tokenPayload.userId;

      // Resolve user's own API credentials (falls back to platform key when null)
      const userCreds = await getUserAICredentials(userId);

    // Parse request body
    const body = await request.json();
    const validation = generateContentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      type,
      platform,
      topic,
      tone,
      keywords,
      targetAudience,
      length,
      includeEmojis,
      includeHashtags,
      includeCTA,
      batchRequests
    } = validation.data;

    // Track content generation event
    authMonitor.trackEvent({
      type: 'content_generation',
      method: 'ai',
      timestamp: Date.now(),
      metadata: { platform, type }
    });

    // Handle batch generation
    if (batchRequests && Array.isArray(batchRequests)) {
      const results = await aiContentGenerator.batchGenerate(batchRequests);
      return NextResponse.json({
        success: true,
        data: results,
        count: results.length
      });
    }

    // Single content generation — passes user credentials when available so
    // the request uses the user's own API key rather than the platform key.
    const generatedContent = await aiContentGenerator.generateContent(
      {
        type,
        platform,
        topic,
        tone,
        keywords,
        targetAudience,
        length,
        includeEmojis,
        includeHashtags,
        includeCTA,
      },
      userCreds ?? undefined
    );

    // Track usage for subscription limits
    await UsageTracker.track(userId, 'ai_posts', 1);

    return NextResponse.json({
      success: true,
      data: generatedContent
    });

    } catch (error) {
    logger.error('Content generation API error', { error });
    
    // Track error
    authMonitor.trackEvent({
      type: 'content_generation_error',
      method: 'ai',
      timestamp: Date.now(),
      metadata: { error: String(error) }
    });

    return NextResponse.json(
      { 
        error: 'Failed to generate content',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const platforms = searchParams.get('platforms')?.split(',') || ['twitter', 'instagram', 'linkedin'];
    const postsPerDay = parseInt(searchParams.get('postsPerDay') || '3');

    // Generate content calendar
    const calendar = await aiContentGenerator.generateContentCalendar(
      days,
      platforms,
      postsPerDay
    );

    // Convert Map to object for JSON serialization
    const calendarObject: Record<string, unknown> = {};
    calendar.forEach((value, key) => {
      calendarObject[key] = value;
    });

    return NextResponse.json({
      success: true,
      data: calendarObject,
      metadata: {
        days,
        platforms,
        postsPerDay,
        totalPosts: days * platforms.length * postsPerDay
      }
    });

  } catch (error) {
    logger.error('Calendar generation error', { error });
    return NextResponse.json(
      { error: 'Failed to generate content calendar' },
      { status: 500 }
    );
  }
}