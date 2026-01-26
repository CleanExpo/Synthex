/**
 * AI Content Generation API Endpoint
 * Handles requests for AI-powered content creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiContentGenerator } from '@/src/lib/ai/content-generator';
import { authMonitor } from '@/src/lib/auth/monitoring';
import { logger } from '@/lib/logger';

import { withRateLimit, UsageTracker } from '@/lib/middleware/rate-limiter';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return withRateLimit(request, async () => {
    try {
      // Verify authentication
      const authToken = request.cookies.get('auth-token')?.value;
      if (!authToken) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

    // Parse request body
    const body = await request.json();
    const {
      type = 'post',
      platform,
      topic,
      tone,
      keywords,
      targetAudience,
      length,
      includeEmojis = true,
      includeHashtags = true,
      includeCTA = false,
      batchRequests
    } = body;

    // Validate required fields
    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

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

    // Single content generation
    const generatedContent = await aiContentGenerator.generateContent({
      type,
      platform,
      topic,
      tone,
      keywords,
      targetAudience,
      length,
      includeEmojis,
      includeHashtags,
      includeCTA
    });

    // Track usage for subscription limits
    await UsageTracker.track('user_id_here', 'ai_posts', 1);

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
    const calendarObject: Record<string, any> = {};
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