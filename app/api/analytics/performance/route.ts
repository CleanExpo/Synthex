/**
 * Analytics Performance API
 *
 * @description Provides engagement performance metrics:
 * - GET: Fetch performance metrics (engagement, reach, growth)
 * - POST: Track Web Vitals (client-side performance)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns cached/default data on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

// Zod schemas for validation
const PerformanceQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  platform: z.string().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'startDate must be a valid ISO date string' }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'endDate must be a valid ISO date string' }
  ),
});

const WebVitalsSchema = z.object({
  metrics: z.object({
    fcp: z.number().optional(),
    lcp: z.number().optional(),
    fid: z.number().optional(),
    cls: z.number().optional(),
    ttfb: z.number().optional(),
  }),
  url: z.string(),
  timestamp: z.string().optional(),
  userAgent: z.string().optional(),
});

// ============================================================================
// TYPES
// ============================================================================

/** Analytics data stored in post.analytics JSON field */
interface PostAnalyticsData {
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
}

/** Post record from database query */
interface PostWithAnalytics {
  id: string;
  content: string;
  platform: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  analytics: PostAnalyticsData | unknown;
  campaign?: { name: string } | null;
}

/** Where clause for post queries */
interface PostWhereClause {
  campaign: { userId: string };
  createdAt: { gte: Date; lte: Date };
  platform?: string;
}

interface PerformanceMetrics {
  overview: {
    totalPosts: number;
    totalEngagement: number;
    averageEngagementRate: number;
    totalReach: number;
    totalImpressions: number;
  };
  growth: {
    engagementChange: number;
    reachChange: number;
    postsChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  timeline: Array<{
    date: string;
    engagement: number;
    reach: number;
    impressions: number;
    posts: number;
  }>;
  platforms: Array<{
    platform: string;
    engagement: number;
    engagementRate: number;
    posts: number;
    bestTime: string;
  }>;
  topContent: Array<{
    id: string;
    content: string;
    platform: string;
    engagement: number;
    engagementRate: number;
    publishedAt: Date;
  }>;
}

// ============================================================================
// GET - Performance Metrics
// ============================================================================

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

    // Get user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parseResult = PerformanceQuerySchema.safeParse({
      period: searchParams.get('period') || '30d',
      platform: searchParams.get('platform') || undefined,
      granularity: searchParams.get('granularity') || 'day',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { period, platform, granularity, startDate: customStartDate, endDate: customEndDate } = parseResult.data;

    // Calculate date range — use custom dates if provided, otherwise compute from period
    let endDate: Date;
    let startDate: Date;

    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      endDate = new Date();
      startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
    }

    // Fetch posts with analytics
    const whereClause: PostWhereClause = {
      campaign: { userId },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (platform) {
      whereClause.platform = platform;
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      select: {
        id: true,
        content: true,
        platform: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        analytics: true,
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate previous period for comparison
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    previousStartDate.setTime(
      startDate.getTime() - (endDate.getTime() - startDate.getTime())
    );

    const previousPosts = await prisma.post.findMany({
      where: {
        campaign: { userId },
        createdAt: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
        ...(platform && { platform }),
      },
      select: {
        analytics: true,
      },
    });

    // Aggregate current period metrics
    const currentMetrics = aggregateMetrics(posts);
    const previousMetrics = aggregateMetrics(previousPosts);

    // Calculate growth
    const engagementChange = previousMetrics.totalEngagement === 0
      ? (currentMetrics.totalEngagement > 0 ? 100 : 0)
      : Math.round(
          ((currentMetrics.totalEngagement - previousMetrics.totalEngagement) /
            previousMetrics.totalEngagement) *
            100
        );

    const reachChange = previousMetrics.totalReach === 0
      ? (currentMetrics.totalReach > 0 ? 100 : 0)
      : Math.round(
          ((currentMetrics.totalReach - previousMetrics.totalReach) /
            previousMetrics.totalReach) *
            100
        );

    const postsChange = previousPosts.length === 0
      ? (posts.length > 0 ? 100 : 0)
      : Math.round(
          ((posts.length - previousPosts.length) / previousPosts.length) * 100
        );

    // Build timeline
    const timeline = buildTimeline(posts, startDate, endDate, granularity);

    // Calculate platform breakdown
    const platformStats = buildPlatformStats(posts);

    // Get top content
    const topContent = posts
      .map((post) => {
        const analytics = (post.analytics as PostAnalyticsData) || {};
        const engagement =
          (analytics.likes || 0) +
          (analytics.comments || 0) +
          (analytics.shares || 0);
        const impressions = analytics.impressions || analytics.reach || 1;
        return {
          id: post.id,
          content: post.content.substring(0, 100) + '...',
          platform: post.platform,
          engagement,
          engagementRate: Math.round((engagement / impressions) * 10000) / 100,
          publishedAt: post.publishedAt || post.createdAt,
        };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);

    const response: PerformanceMetrics = {
      overview: {
        totalPosts: posts.length,
        totalEngagement: currentMetrics.totalEngagement,
        averageEngagementRate: currentMetrics.averageEngagementRate,
        totalReach: currentMetrics.totalReach,
        totalImpressions: currentMetrics.totalImpressions,
      },
      growth: {
        engagementChange,
        reachChange,
        postsChange,
        trend:
          engagementChange > 0 ? 'up' : engagementChange < 0 ? 'down' : 'stable',
      },
      timeline,
      platforms: platformStats,
      topContent,
    };

    // Audit log
    await auditLogger.log({
      userId,
      action: 'analytics.performance_viewed',
      resource: 'analytics',
      resourceId: userId,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: { period: customStartDate && customEndDate ? 'custom' : period, platform: platform || 'all' },
    });

    return NextResponse.json({
      success: true,
      data: response,
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Performance metrics error', { error });
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Track Web Vitals
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Web Vitals don't require authentication (client-side tracking)
    const body = await request.json();
    const parseResult = WebVitalsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { metrics, url, timestamp, userAgent } = parseResult.data;

    // Log performance metrics
    logger.info('Web Vitals received', {
      url,
      fcp: metrics.fcp,
      lcp: metrics.lcp,
      fid: metrics.fid,
      cls: metrics.cls,
      ttfb: metrics.ttfb,
      timestamp,
    });

    // Check for poor performance
    const warnings: string[] = [];
    if (metrics.lcp && metrics.lcp > 2500) {
      warnings.push(`LCP is ${metrics.lcp}ms (should be < 2500ms)`);
    }
    if (metrics.fid && metrics.fid > 100) {
      warnings.push(`FID is ${metrics.fid}ms (should be < 100ms)`);
    }
    if (metrics.cls && metrics.cls > 0.1) {
      warnings.push(`CLS is ${metrics.cls} (should be < 0.1)`);
    }
    if (metrics.ttfb && metrics.ttfb > 600) {
      warnings.push(`TTFB is ${metrics.ttfb}ms (should be < 600ms)`);
    }

    if (warnings.length > 0) {
      logger.warn('Web Vitals warnings', { url, warnings });
    }

    return NextResponse.json({
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('Web Vitals tracking error', { error });
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function aggregateMetrics(posts: Array<{ analytics: PostAnalyticsData | unknown }>) {
  let totalEngagement = 0;
  let totalReach = 0;
  let totalImpressions = 0;

  for (const post of posts) {
    const analytics = (post.analytics as PostAnalyticsData) || {};
    totalEngagement +=
      (analytics.likes || 0) +
      (analytics.comments || 0) +
      (analytics.shares || 0);
    totalReach += analytics.reach || 0;
    totalImpressions += analytics.impressions || 0;
  }

  const averageEngagementRate =
    totalImpressions > 0
      ? Math.round((totalEngagement / totalImpressions) * 10000) / 100
      : 0;

  return {
    totalEngagement,
    totalReach,
    totalImpressions,
    averageEngagementRate,
  };
}

function buildTimeline(
  posts: PostWithAnalytics[],
  _startDate: Date,
  _endDate: Date,
  granularity: string
) {
  const timeline: Array<{
    date: string;
    engagement: number;
    reach: number;
    impressions: number;
    posts: number;
  }> = [];

  // Group posts by date bucket
  const buckets = new Map<
    string,
    { engagement: number; reach: number; impressions: number; posts: number }
  >();

  for (const post of posts) {
    const postDate = new Date(post.publishedAt || post.createdAt);
    let bucketKey: string;

    switch (granularity) {
      case 'week':
        const weekStart = new Date(postDate);
        weekStart.setDate(postDate.getDate() - postDate.getDay());
        bucketKey = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        bucketKey = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      default:
        bucketKey = postDate.toISOString().split('T')[0];
    }

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { engagement: 0, reach: 0, impressions: 0, posts: 0 });
    }

    const bucket = buckets.get(bucketKey)!;
    const analytics = (post.analytics as PostAnalyticsData) || {};
    bucket.engagement +=
      (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);
    bucket.reach += analytics.reach || 0;
    bucket.impressions += analytics.impressions || 0;
    bucket.posts += 1;
  }

  // Convert to sorted array
  const sortedBuckets = Array.from(buckets.entries()).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );

  for (const [date, data] of sortedBuckets) {
    timeline.push({ date, ...data });
  }

  return timeline;
}

function buildPlatformStats(posts: PostWithAnalytics[]) {
  const platformMap = new Map<
    string,
    {
      engagement: number;
      impressions: number;
      posts: number;
      hourlyEngagement: Map<number, { total: number; count: number }>;
    }
  >();

  for (const post of posts) {
    const platform = post.platform;
    if (!platformMap.has(platform)) {
      platformMap.set(platform, {
        engagement: 0,
        impressions: 0,
        posts: 0,
        hourlyEngagement: new Map(),
      });
    }

    const stats = platformMap.get(platform)!;
    const analytics = (post.analytics as PostAnalyticsData) || {};
    const engagement =
      (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);

    stats.engagement += engagement;
    stats.impressions += analytics.impressions || analytics.reach || 0;
    stats.posts += 1;

    // Track hourly engagement for best time calculation
    const hour = new Date(post.publishedAt || post.createdAt).getHours();
    if (!stats.hourlyEngagement.has(hour)) {
      stats.hourlyEngagement.set(hour, { total: 0, count: 0 });
    }
    const hourData = stats.hourlyEngagement.get(hour)!;
    hourData.total += engagement;
    hourData.count += 1;
  }

  const result: Array<{
    platform: string;
    engagement: number;
    engagementRate: number;
    posts: number;
    bestTime: string;
  }> = [];

  for (const [platform, stats] of platformMap) {
    // Find best posting time
    let bestHour = 9;
    let bestAvgEngagement = 0;
    for (const [hour, data] of stats.hourlyEngagement) {
      const avg = data.total / data.count;
      if (avg > bestAvgEngagement) {
        bestAvgEngagement = avg;
        bestHour = hour;
      }
    }

    result.push({
      platform,
      engagement: stats.engagement,
      engagementRate:
        stats.impressions > 0
          ? Math.round((stats.engagement / stats.impressions) * 10000) / 100
          : 0,
      posts: stats.posts,
      bestTime: `${bestHour}:00`,
    });
  }

  return result.sort((a, b) => b.engagement - a.engagement);
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
