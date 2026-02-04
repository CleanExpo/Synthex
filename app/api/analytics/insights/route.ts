/**
 * Analytics Insights API
 * GET /api/analytics/insights - Get analytics insights and trends
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Validation schemas
const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
  platform: z.string().optional(),
  campaignId: z.string().cuid().optional()
});

/**
 * GET /api/analytics/insights
 * Returns analytics insights for the authenticated user
 */
export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      period: url.searchParams.get('period') || undefined,
      platform: url.searchParams.get('platform') || undefined,
      campaignId: url.searchParams.get('campaignId') || undefined
    };

    const query = querySchema.parse(queryParams);

    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    switch (query.period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get user's campaigns
    const userCampaigns = await prisma.campaign.findMany({
      where: { userId: security.context.userId },
      select: { id: true }
    });
    const campaignIds = userCampaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return APISecurityChecker.createSecureResponse(
        {
          data: {
            overview: {
              totalPosts: 0,
              publishedPosts: 0,
              scheduledPosts: 0,
              failedPosts: 0,
              engagementRate: 0
            },
            trends: [],
            topPerformingPosts: [],
            platformBreakdown: []
          },
          period: query.period,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        },
        200,
        security.context
      );
    }

    // Build where clause for posts
    const postWhereClause: any = {
      campaignId: query.campaignId ? query.campaignId : { in: campaignIds },
      createdAt: { gte: startDate }
    };

    if (query.platform) {
      postWhereClause.platform = query.platform;
    }

    // Get post statistics
    const [totalPosts, publishedPosts, scheduledPosts, failedPosts] = await Promise.all([
      prisma.post.count({ where: postWhereClause }),
      prisma.post.count({ where: { ...postWhereClause, status: 'published' } }),
      prisma.post.count({ where: { ...postWhereClause, status: 'scheduled' } }),
      prisma.post.count({ where: { ...postWhereClause, status: 'failed' } })
    ]);

    // Get analytics events for engagement calculation
    const analyticsEvents = await prisma.analyticsEvent.findMany({
      where: {
        userId: security.context.userId,
        timestamp: { gte: startDate },
        ...(query.platform && { platform: query.platform }),
        ...(query.campaignId && { campaignId: query.campaignId })
      },
      orderBy: { timestamp: 'desc' },
      take: 1000
    });

    // Calculate engagement metrics from events
    const engagementEvents = analyticsEvents.filter(e =>
      ['like', 'comment', 'share', 'click', 'view'].includes(e.type)
    );
    const viewEvents = analyticsEvents.filter(e => e.type === 'view').length || 1;
    const engagementRate = viewEvents > 0
      ? ((engagementEvents.length / viewEvents) * 100).toFixed(2)
      : 0;

    // Get top performing posts (by analytics data)
    const postsWithAnalytics = await prisma.post.findMany({
      where: {
        ...postWhereClause,
        status: 'published',
        analytics: { not: null }
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        content: true,
        platform: true,
        publishedAt: true,
        analytics: true,
        campaign: {
          select: { id: true, name: true }
        }
      }
    });

    // Calculate platform breakdown
    const platformCounts = await prisma.post.groupBy({
      by: ['platform'],
      where: postWhereClause,
      _count: { id: true }
    });

    const platformBreakdown = platformCounts.map(p => ({
      platform: p.platform,
      count: p._count.id,
      percentage: totalPosts > 0 ? ((p._count.id / totalPosts) * 100).toFixed(1) : 0
    }));

    // Generate daily trends
    const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends = [];

    for (let i = 0; i < Math.min(daysDiff, 30); i++) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayPosts = await prisma.post.count({
        where: {
          ...postWhereClause,
          createdAt: { gte: dayStart, lte: dayEnd }
        }
      });

      const dayEvents = analyticsEvents.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate >= dayStart && eventDate <= dayEnd;
      });

      trends.unshift({
        date: dayStart.toISOString().split('T')[0],
        posts: dayPosts,
        engagements: dayEvents.length
      });
    }

    return APISecurityChecker.createSecureResponse(
      {
        data: {
          overview: {
            totalPosts,
            publishedPosts,
            scheduledPosts,
            failedPosts,
            engagementRate: parseFloat(String(engagementRate))
          },
          trends,
          topPerformingPosts: postsWithAnalytics.map(post => ({
            id: post.id,
            content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            platform: post.platform,
            publishedAt: post.publishedAt,
            campaign: post.campaign,
            analytics: post.analytics
          })),
          platformBreakdown
        },
        period: query.period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Analytics insights error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid query parameters', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch analytics insights' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}
