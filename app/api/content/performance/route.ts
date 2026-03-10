/**
 * Content Performance API
 *
 * @description Analyzes historical post performance to identify patterns
 * and generate actionable insights.
 *
 * GET /api/content/performance
 * Query: platform (all|specific), period (7d|30d|90d), includeAI (true|false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  ContentPerformanceAnalyzer,
  PostPerformance,
  ContentPerformanceAnalysis,
} from '@/lib/ai/content-performance-analyzer';


// =============================================================================
// GET - Content Performance Analysis
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platformFilter = searchParams.get('platform') || 'all';
    const period = searchParams.get('period') || '30d';
    const includeAI = searchParams.get('includeAI') !== 'false';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Fetch user's connected platforms
    const connections = await prisma.platformConnection.findMany({
      where: {
        userId: userId,
        organizationId: organizationId ?? null,
        isActive: true,
        ...(platformFilter !== 'all' && { platform: platformFilter }),
      },
      select: { id: true, platform: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        data: emptyAnalysis(),
        message: 'No connected platforms found',
      });
    }

    const connectionIds = connections.map((c) => c.id);

    // Fetch posts with metrics
    const posts = await prisma.platformPost.findMany({
      where: {
        connectionId: { in: connectionIds },
        status: 'published',
        publishedAt: { gte: startDate },
      },
      select: {
        id: true,
        platformId: true,
        content: true,
        hashtags: true,
        publishedAt: true,
        connection: {
          select: { platform: true },
        },
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            likes: true,
            comments: true,
            shares: true,
            impressions: true,
            engagementRate: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        data: emptyAnalysis(),
        message: 'No published posts found in the selected period',
      });
    }

    // Transform to PostPerformance format
    const postPerformances: PostPerformance[] = posts
      .filter((post) => post.metrics.length > 0)
      .map((post) => {
        const metrics = post.metrics[0];
        return {
          postId: post.id,
          platform: post.connection.platform.toLowerCase(),
          content: post.content,
          hashtags: post.hashtags || [],
          publishedAt: post.publishedAt || new Date(),
          metrics: {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            impressions: metrics.impressions,
            engagementRate: metrics.engagementRate || 0,
          },
        };
      });

    if (postPerformances.length === 0) {
      return NextResponse.json({
        success: true,
        data: emptyAnalysis(),
        message: 'No posts with metrics found',
      });
    }

    // Analyze performance
    const analyzer = new ContentPerformanceAnalyzer();
    let analysis: ContentPerformanceAnalysis;

    try {
      analysis = await analyzer.analyze(postPerformances);
    } catch (error) {
      logger.error('Failed to analyze performance:', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({
        success: true,
        data: emptyAnalysis(),
        message: 'Analysis failed, please try again',
      });
    }

    // Generate AI insights if requested
    if (includeAI && analysis.summary.totalPosts >= 5) {
      try {
        const aiInsights = await analyzer.generateAIInsights(analysis);
        if (aiInsights.length > 0) {
          // Merge AI insights with basic insights, avoiding duplicates
          const existingTypes = new Set(analysis.insights.map((i) => `${i.type}-${i.title}`));
          const newInsights = aiInsights.filter(
            (i) => !existingTypes.has(`${i.type}-${i.title}`)
          );
          analysis.insights = [...analysis.insights, ...newInsights].slice(0, 8);
        }
      } catch (error) {
        logger.warn('AI insights generation failed, returning basic insights:', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with basic insights
      }
    }

    return NextResponse.json({
      success: true,
      data: analysis,
      meta: {
        platform: platformFilter,
        period,
        postsAnalyzed: postPerformances.length,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Content performance API error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to analyze content performance' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function emptyAnalysis(): ContentPerformanceAnalysis {
  return {
    summary: {
      totalPosts: 0,
      avgEngagement: 0,
      topPerforming: [],
      lowPerforming: [],
    },
    patterns: {
      bestDays: [],
      bestHours: [],
      bestLength: { min: 0, max: 0, avgEngagement: 0 },
      topHashtags: [],
    },
    insights: [],
    contentTypes: [],
  };
}
