/**
 * Analytics API
 *
 * Provides analytics data for social media performance.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/analytics/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import {
  getEffectiveQueryFilter,
  getEffectiveOrganizationId,
} from '@/lib/multi-business/business-scope';
import { getRedisClient } from '@/lib/redis-client';

const ANALYTICS_CACHE_TTL = 300; // seconds

// =============================================================================
// Schemas
// =============================================================================

const analyticsQuerySchema = z.object({
  timeRange: z
    .enum(['7d', '30d', '90d', '12m', 'all'])
    .optional()
    .default('30d'),
  platform: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// GET - Get Analytics Data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const validation = analyticsQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { timeRange, platform } = validation.data;

    // Resolve org-scoped query filter from the JWT — never trust the request
    // body for the organisation context (SYN-406).
    const campaignFilter = await getEffectiveQueryFilter(userId);

    // Guard: an empty filter means no valid org context was found. Returning
    // data without a scope would expose every campaign in the database.
    if (Object.keys(campaignFilter).length === 0) {
      return NextResponse.json(
        { error: 'No organisation context found' },
        { status: 403 }
      );
    }

    // ── Cache read ──────────────────────────────────────────────────────────
    const orgId = await getEffectiveOrganizationId(userId);
    const paramsHash = `${timeRange}:${platform ?? 'all'}`;
    const cacheKey = `synthex:cache:analytics:${orgId ?? userId}:${paramsHash}`;
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Re-inject generatedAt so consumers always see the serve-time timestamp,
        // not the frozen value that was stored when the cache was populated.
        const parsed = JSON.parse(cached);
        return NextResponse.json({
          ...parsed,
          data: { ...parsed.data, generatedAt: new Date().toISOString() },
        });
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '12m':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // Get campaign IDs scoped to the user's active organisation context
    const campaigns = await prisma.campaign.findMany({
      where: campaignFilter,
      select: { id: true },
      take: 1000,
    });
    const campaignIds = campaigns.map(c => c.id);

    // Build where clause for posts
    const postWhere: Record<string, unknown> = {
      campaignId: { in: campaignIds },
      createdAt: { gte: startDate },
    };

    if (platform) {
      postWhere.platform = platform;
    }

    // Get post statistics and recent activity in parallel — both queries depend
    // only on already-computed values (campaignIds, userId, startDate).
    const [posts, recentActivity] = await Promise.all([
      prisma.post.findMany({
        where: postWhere,
        select: {
          id: true,
          platform: true,
          status: true,
          analytics: true,
          publishedAt: true,
          createdAt: true,
        },
        take: 1000,
      }),
      prisma.apiUsage.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          endpoint: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate totals
    const totals = {
      posts: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      draft: posts.filter(p => p.status === 'draft').length,
      reach: 0,
      engagement: 0,
      impressions: 0,
      clicks: 0,
    };

    // Aggregate analytics from posts
    posts.forEach(post => {
      if (post.analytics && typeof post.analytics === 'object') {
        const analytics = post.analytics as Record<string, number>;
        totals.reach += analytics.reach || 0;
        totals.engagement += analytics.engagement || 0;
        totals.impressions += analytics.impressions || 0;
        totals.clicks += analytics.clicks || 0;
      }
    });

    // Calculate engagement rate
    const engagementRate =
      totals.impressions > 0
        ? ((totals.engagement / totals.impressions) * 100).toFixed(2)
        : '0.00';

    // Get platform breakdown
    const platformBreakdown = posts.reduce(
      (acc, post) => {
        if (!acc[post.platform]) {
          acc[post.platform] = { posts: 0, published: 0 };
        }
        acc[post.platform].posts++;
        if (post.status === 'published') {
          acc[post.platform].published++;
        }
        return acc;
      },
      {} as Record<string, { posts: number; published: number }>
    );

    // Get daily post counts for chart
    const dailyCounts = posts.reduce(
      (acc, post) => {
        const date = post.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date]++;
        return acc;
      },
      {} as Record<string, number>
    );

    const chartData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, posts: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const responseData = {
      data: {
        totals: {
          ...totals,
          engagementRate: parseFloat(engagementRate),
        },
        platformBreakdown,
        chartData,
        recentActivity,
        timeRange,
        generatedAt: new Date().toISOString(),
      },
    };

    // ── Cache write ─────────────────────────────────────────────────────────
    // Strip generatedAt before storing so the cached payload never freezes it.
    // It is re-injected at serve-time on cache hits (see cache read block above).
    try {
      const redis = getRedisClient();
      const { generatedAt: _g, ...dataToCache } = responseData.data;
      await redis.set(
        cacheKey,
        JSON.stringify({ data: dataToCache }),
        ANALYTICS_CACHE_TTL
      );
    } catch {
      // Non-fatal — response already built
    }

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
