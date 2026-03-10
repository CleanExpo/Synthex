/**
 * Benchmark Reports API
 *
 * @description Generates benchmark comparison reports comparing
 * user's performance to industry standards.
 *
 * GET /api/analytics/benchmarks
 * Query: platform (all|specific), period (7d|30d|90d)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  BenchmarkService,
  UserMetrics,
  BenchmarkReport,
} from '@/lib/analytics/benchmark-service';


// =============================================================================
// GET - Benchmark Report
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
        data: emptyReport(),
        message: 'No connected platforms found',
      });
    }

    const connectionIds = connections.map((c) => c.id);

    // Fetch posts and metrics for the period
    const posts = await prisma.platformPost.findMany({
      where: {
        connectionId: { in: connectionIds },
        status: 'published',
        publishedAt: { gte: startDate },
      },
      select: {
        id: true,
        connectionId: true,
        publishedAt: true,
        connection: {
          select: { platform: true, metadata: true },
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
    });

    // Calculate user metrics per platform
    const platformMetrics: Record<string, {
      posts: number;
      totalEngagement: number;
      totalImpressions: number;
      engagementRates: number[];
    }> = {};

    for (const post of posts) {
      const platform = post.connection.platform.toLowerCase();
      if (!platformMetrics[platform]) {
        platformMetrics[platform] = {
          posts: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          engagementRates: [],
        };
      }

      platformMetrics[platform].posts++;

      if (post.metrics.length > 0) {
        const metrics = post.metrics[0];
        const engagement = metrics.likes + metrics.comments + metrics.shares;
        platformMetrics[platform].totalEngagement += engagement;
        platformMetrics[platform].totalImpressions += metrics.impressions;
        if (metrics.engagementRate) {
          platformMetrics[platform].engagementRates.push(metrics.engagementRate);
        }
      }
    }

    // Get follower counts and calculate growth
    const followerData: Record<string, { current: number; previous: number }> = {};

    for (const conn of connections) {
      const platform = conn.platform.toLowerCase();
      const meta = (conn as { metadata?: { followers?: number } }).metadata;
      const currentFollowers = meta?.followers || 0;

      // For now, estimate previous followers (in real app, would query historical data)
      const previousFollowers = Math.round(currentFollowers * 0.97); // Assume ~3% growth

      followerData[platform] = {
        current: currentFollowers,
        previous: previousFollowers,
      };
    }

    // Build UserMetrics array
    const userMetricsList: UserMetrics[] = [];

    for (const [platform, data] of Object.entries(platformMetrics)) {
      const avgEngagementRate =
        data.engagementRates.length > 0
          ? data.engagementRates.reduce((a, b) => a + b, 0) / data.engagementRates.length
          : data.totalImpressions > 0
          ? (data.totalEngagement / data.totalImpressions) * 100
          : 0;

      const followers = followerData[platform] || { current: 0, previous: 0 };
      const followerGrowth =
        followers.previous > 0
          ? ((followers.current - followers.previous) / followers.previous) * 100
          : 0;

      const weeksInPeriod = days / 7;
      const postFrequency = weeksInPeriod > 0 ? data.posts / weeksInPeriod : 0;

      const reachRate =
        followers.current > 0
          ? (data.totalImpressions / (data.posts || 1) / followers.current) * 100
          : 0;

      userMetricsList.push({
        platform,
        engagementRate: Math.round(avgEngagementRate * 100) / 100,
        followerGrowth: Math.round(followerGrowth * 100) / 100,
        postFrequency: Math.round(postFrequency * 10) / 10,
        reachRate: Math.round(reachRate * 100) / 100,
      });
    }

    if (userMetricsList.length === 0) {
      return NextResponse.json({
        success: true,
        data: emptyReport(),
        message: 'No performance data found for the selected period',
      });
    }

    // Generate benchmark report
    const benchmarkService = new BenchmarkService();
    const report = benchmarkService.generateReport(userMetricsList);

    return NextResponse.json({
      success: true,
      data: report,
      meta: {
        platform: platformFilter,
        period,
        platformsAnalyzed: userMetricsList.length,
        postsAnalyzed: posts.length,
      },
    });
  } catch (error) {
    logger.error('Benchmark API error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to generate benchmark report' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function emptyReport(): BenchmarkReport {
  return {
    overall: {
      score: 0,
      rating: 'below',
      percentile: 0,
    },
    byPlatform: [],
    insights: ['Connect platforms and create posts to see benchmark comparisons'],
    recommendations: [],
    generatedAt: new Date().toISOString(),
  };
}
