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

// =============================================================================
// Schemas
// =============================================================================

const analyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '12m', 'all']).optional().default('30d'),
  platform: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.default.verify(token, secret) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// =============================================================================
// GET - Get Analytics Data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
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

    // Get user's campaign IDs
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true },
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

    // Get post statistics
    const posts = await prisma.post.findMany({
      where: postWhere,
      select: {
        id: true,
        platform: true,
        status: true,
        analytics: true,
        publishedAt: true,
        createdAt: true,
      },
    });

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
    const engagementRate = totals.impressions > 0
      ? ((totals.engagement / totals.impressions) * 100).toFixed(2)
      : '0.00';

    // Get platform breakdown
    const platformBreakdown = posts.reduce((acc, post) => {
      if (!acc[post.platform]) {
        acc[post.platform] = { posts: 0, published: 0 };
      }
      acc[post.platform].posts++;
      if (post.status === 'published') {
        acc[post.platform].published++;
      }
      return acc;
    }, {} as Record<string, { posts: number; published: number }>);

    // Get recent activity (API usage)
    const recentActivity = await prisma.apiUsage.findMany({
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
    });

    // Get daily post counts for chart
    const dailyCounts = posts.reduce((acc, post) => {
      const date = post.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date]++;
      return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, posts: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
