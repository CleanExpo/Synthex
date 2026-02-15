/**
 * Team Statistics API
 *
 * @description API endpoint for team statistics:
 * - GET: Fetch team statistics (members, campaigns, content, reach)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// ============================================================================
// GET - Team Statistics
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

    // Get requesting user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get requesting user's organization
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            plan: true,
            maxUsers: true,
            maxPosts: true,
            maxCampaigns: true,
          },
        },
      },
    });

    if (!requestingUser?.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization' },
        { status: 403 }
      );
    }

    const organizationId = requestingUser.organizationId;

    // Parse query parameters for time period
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // '7d', '30d', '90d', '1y'

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
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

    // Get member statistics
    const totalMembers = await prisma.user.count({
      where: { organizationId },
    });

    const membersJoinedThisPeriod = await prisma.user.count({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
    });

    const activeMembers = await prisma.user.count({
      where: {
        organizationId,
        lastLogin: { gte: startDate },
      },
    });

    // Get pending invitations count
    const pendingInvitations = await (prisma as any).teamInvitation.count({
      where: {
        organizationId,
        status: 'sent',
      },
    });

    // Get campaign statistics
    const memberIds = await prisma.user
      .findMany({
        where: { organizationId },
        select: { id: true },
      })
      .then((users) => users.map((u) => u.id));

    const totalCampaigns = await prisma.campaign.count({
      where: { userId: { in: memberIds } },
    });

    const activeCampaigns = await prisma.campaign.count({
      where: {
        userId: { in: memberIds },
        status: 'active',
      },
    });

    const campaignsThisPeriod = await prisma.campaign.count({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: startDate },
      },
    });

    // Get content statistics
    const campaignIds = await prisma.campaign
      .findMany({
        where: { userId: { in: memberIds } },
        select: { id: true },
      })
      .then((campaigns) => campaigns.map((c) => c.id));

    const totalContent = await prisma.post.count({
      where: { campaignId: { in: campaignIds } },
    });

    const contentThisPeriod = await prisma.post.count({
      where: {
        campaignId: { in: campaignIds },
        createdAt: { gte: startDate },
      },
    });

    const publishedContent = await prisma.post.count({
      where: {
        campaignId: { in: campaignIds },
        status: 'published',
      },
    });

    // Get reach/engagement metrics from published posts
    const postsWithAnalytics = await prisma.post.findMany({
      where: {
        campaignId: { in: campaignIds },
        status: 'published',
        publishedAt: { gte: startDate },
      },
      select: {
        analytics: true,
      },
    });

    let totalReach = 0;
    let totalEngagement = 0;
    let totalImpressions = 0;

    for (const post of postsWithAnalytics) {
      const analytics = (post.analytics as any) || {};
      totalReach += analytics.reach || 0;
      totalImpressions += analytics.impressions || 0;
      totalEngagement +=
        (analytics.likes || 0) +
        (analytics.comments || 0) +
        (analytics.shares || 0);
    }

    // Get content by platform
    const contentByPlatform = await prisma.post.groupBy({
      by: ['platform'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });

    const platformBreakdown = contentByPlatform.map((p) => ({
      platform: p.platform,
      count: p._count.id,
    }));

    // Calculate member contribution stats
    const memberContributions = await prisma.campaign.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    });

    const topContributors = await Promise.all(
      memberContributions
        .sort((a, b) => b._count.id - a._count.id)
        .slice(0, 5)
        .map(async (c) => {
          const user = await prisma.user.findUnique({
            where: { id: c.userId },
            select: { id: true, name: true, email: true, avatar: true },
          });
          return {
            id: user?.id,
            name: user?.name || user?.email?.split('@')[0] || 'Unknown',
            avatar: user?.avatar,
            campaignsCreated: c._count.id,
          };
        })
    );

    // Calculate usage against limits
    const limits = {
      users: {
        current: totalMembers + pendingInvitations,
        max: requestingUser.organization?.maxUsers || 5,
      },
      campaigns: {
        current: totalCampaigns,
        max: requestingUser.organization?.maxCampaigns || 10,
      },
      posts: {
        current: totalContent,
        max: requestingUser.organization?.maxPosts || 500,
      },
    };

    return ResponseOptimizer.createResponse(
      {
        success: true,
        data: {
          overview: {
            totalMembers,
            activeMembers,
            membersJoinedThisPeriod,
            pendingInvitations,
            activeCampaigns,
            totalContent,
            totalReach,
            totalEngagement,
          },
          campaigns: {
            total: totalCampaigns,
            active: activeCampaigns,
            createdThisPeriod: campaignsThisPeriod,
          },
          content: {
            total: totalContent,
            published: publishedContent,
            createdThisPeriod: contentThisPeriod,
            platformBreakdown,
          },
          engagement: {
            totalReach,
            totalImpressions,
            totalEngagement,
            engagementRate:
              totalImpressions > 0
                ? Math.round((totalEngagement / totalImpressions) * 10000) / 100
                : 0,
          },
          topContributors,
          limits,
          organization: {
            name: requestingUser.organization?.name,
            plan: requestingUser.organization?.plan,
          },
          period: {
            type: period,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        },
      },
      { cacheType: 'api', cacheDuration: 300 }
    );
  } catch (error) {
    logger.error('Failed to fetch team stats', { error });
    return ResponseOptimizer.createErrorResponse('Failed to fetch team stats', 500);
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
