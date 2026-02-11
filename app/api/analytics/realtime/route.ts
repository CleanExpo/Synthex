/**
 * Analytics Realtime API
 * GET /api/analytics/realtime - Get real-time analytics data
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

/**
 * GET /api/analytics/realtime
 * Returns real-time analytics for the authenticated user
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
    const now = new Date();

    // Time windows for realtime data
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get user's campaigns for filtering
    const userCampaigns = await prisma.campaign.findMany({
      where: { userId: security.context.userId },
      select: { id: true }
    });
    const campaignIds = userCampaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return APISecurityChecker.createSecureResponse(
        {
          data: {
            activeNow: 0,
            last5Minutes: { events: 0, engagements: 0 },
            lastHour: { events: 0, engagements: 0, posts: 0 },
            last24Hours: { events: 0, engagements: 0, posts: 0 },
            liveActivity: [],
            platformStatus: []
          },
          timestamp: now.toISOString()
        },
        200,
        security.context
      );
    }

    // Get analytics events for different time windows
    const [
      eventsLast5Min,
      eventsLastHour,
      eventsLast24Hours,
      recentEvents,
      postsLastHour,
      postsLast24Hours
    ] = await Promise.all([
      // Events in last 5 minutes
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: fiveMinutesAgo }
        }
      }),
      // Events in last hour
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: oneHourAgo }
        }
      }),
      // Events in last 24 hours
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: twentyFourHoursAgo }
        }
      }),
      // Recent events for live activity feed
      prisma.analyticsEvent.findMany({
        where: {
          userId: security.context.userId,
          timestamp: { gte: fiveMinutesAgo }
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          platform: true,
          timestamp: true,
          metadata: true
        }
      }),
      // Posts published in last hour
      prisma.post.count({
        where: {
          campaignId: { in: campaignIds },
          status: 'published',
          publishedAt: { gte: oneHourAgo }
        }
      }),
      // Posts published in last 24 hours
      prisma.post.count({
        where: {
          campaignId: { in: campaignIds },
          status: 'published',
          publishedAt: { gte: twentyFourHoursAgo }
        }
      })
    ]);

    // Get engagement events (likes, comments, shares, clicks)
    const engagementTypes = ['like', 'comment', 'share', 'click'];
    const [engagementsLast5Min, engagementsLastHour, engagementsLast24Hours] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: fiveMinutesAgo },
          type: { in: engagementTypes }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: oneHourAgo },
          type: { in: engagementTypes }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          userId: security.context.userId,
          timestamp: { gte: twentyFourHoursAgo },
          type: { in: engagementTypes }
        }
      })
    ]);

    // Get platform status (activity by platform)
    const platformActivity = await prisma.analyticsEvent.groupBy({
      by: ['platform'],
      where: {
        userId: security.context.userId,
        timestamp: { gte: oneHourAgo }
      },
      _count: { id: true }
    });

    const platformStatus = platformActivity.map(p => ({
      platform: p.platform,
      eventsLastHour: p._count.id,
      status: p._count.id > 10 ? 'active' : p._count.id > 0 ? 'low' : 'inactive'
    }));

    // Estimate "active now" based on view events in last 5 minutes
    const viewEventsRecent = await prisma.analyticsEvent.count({
      where: {
        userId: security.context.userId,
        timestamp: { gte: fiveMinutesAgo },
        type: 'view'
      }
    });

    // Rough estimate: assume each view represents ~1 unique visitor
    // In production, this would use session tracking
    const activeNow = Math.min(viewEventsRecent, 100);

    // Format live activity feed
    const liveActivity = recentEvents.map(event => ({
      id: event.id,
      type: event.type,
      platform: event.platform,
      timestamp: event.timestamp.toISOString(),
      description: formatEventDescription(event.type, event.platform)
    }));

    return APISecurityChecker.createSecureResponse(
      {
        data: {
          activeNow,
          last5Minutes: {
            events: eventsLast5Min,
            engagements: engagementsLast5Min
          },
          lastHour: {
            events: eventsLastHour,
            engagements: engagementsLastHour,
            posts: postsLastHour
          },
          last24Hours: {
            events: eventsLast24Hours,
            engagements: engagementsLast24Hours,
            posts: postsLast24Hours
          },
          liveActivity,
          platformStatus
        },
        timestamp: now.toISOString()
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Analytics realtime error:', error);

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch realtime analytics' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Helper to format event descriptions for the live feed
 */
function formatEventDescription(type: string, platform: string | null): string {
  const platformName = platform || 'Unknown';

  switch (type) {
    case 'view':
      return `Post viewed on ${platformName}`;
    case 'like':
      return `Post liked on ${platformName}`;
    case 'comment':
      return `New comment on ${platformName}`;
    case 'share':
      return `Post shared on ${platformName}`;
    case 'click':
      return `Link clicked on ${platformName}`;
    case 'impression':
      return `Impression recorded on ${platformName}`;
    case 'reach':
      return `New reach on ${platformName}`;
    default:
      return `${type} event on ${platformName}`;
  }
}
