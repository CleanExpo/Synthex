import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cache = getCache();
    const cacheKey = `dashboard:stats:${userId}`;
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=30' },
      });
    }

    // Use default 7 days for data range
    const days = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause based on authentication and business context
    // For multi-business owners: scope to their active organization
    // For regular users: scope by userId (existing behavior)
    let userFilter: Record<string, string> = userId ? { userId } : {};
    let campaignFilter: Record<string, unknown> = userId ? { campaign: { userId } } : {};

    if (userId) {
      try {
        const effectiveOrgId = await getEffectiveOrganizationId(userId);
        if (effectiveOrgId) {
          // Multi-business owner with active business: scope by organization
          campaignFilter = { campaign: { userId, organizationId: effectiveOrgId } };
          userFilter = { userId };
        }
      } catch {
        // Fallback to user-only scoping if business scope fails
      }
    }

    // Fetch real metrics from database — all independent queries in parallel
    const [
      totalPostsCount,
      scheduledPostsCount,
      publishedPosts,
      platformConnections,
      platformMetrics,
      recentPostsData,
      activeCampaignsCount,
    ] = await Promise.all([
      // Total posts count
      prisma.post.count({
        where: campaignFilter,
      }),

      // Scheduled posts count
      prisma.post.count({
        where: {
          ...campaignFilter,
          status: 'scheduled',
        },
      }),

      // Get published posts with analytics for engagement calculation
      prisma.post.findMany({
        where: {
          ...campaignFilter,
          status: 'published',
          createdAt: { gte: startDate },
        },
        select: {
          platform: true,
          analytics: true,
          createdAt: true,
        },
      }),

      // Get connected platforms for follower count
      userId
        ? prisma.platformConnection.findMany({
            where: { userId, isActive: true },
            select: { platform: true, metadata: true },
          })
        : Promise.resolve([]),

      // Get platform metrics for reach/followers (scoped to this user)
      prisma.platformMetrics.findMany({
        where: {
          recordedAt: { gte: startDate },
          post: { connection: { userId } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
        select: {
          reach: true,
        },
      }),

      // Recent posts for activity feed
      prisma.post.findMany({
        where: campaignFilter,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          platform: true,
          status: true,
          content: true,
          analytics: true,
          createdAt: true,
          publishedAt: true,
        },
      }),

      // Active campaigns count (was previously a sequential query)
      userId
        ? prisma.campaign.count({ where: { userId, status: 'active' } })
        : Promise.resolve(0),
    ]);

    // Calculate engagement by day
    const engagementByDay: { name: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en', { weekday: 'short' });

      const dayPosts = publishedPosts.filter((p) => {
        const postDate = new Date(p.createdAt);
        return postDate.toDateString() === date.toDateString();
      });

      const totalEngagement = dayPosts.reduce((sum, p) => {
        const analytics = p.analytics as Record<string, number> | null;
        return sum + (analytics?.engagement || 0);
      }, 0);

      engagementByDay.push({
        name: dayName,
        value: totalEngagement,
      });
    }

    // Calculate platform stats
    const platformStats = ['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'].map((platform) => {
      const platformPosts = publishedPosts.filter((p) =>
        p.platform.toLowerCase() === platform.toLowerCase()
      );
      return {
        platform,
        posts: platformPosts.length,
        engagement: platformPosts.reduce((sum, p) => {
          const analytics = p.analytics as Record<string, number> | null;
          return sum + (analytics?.engagement || 0);
        }, 0),
      };
    });

    // Calculate summary stats
    const totalEngagement = publishedPosts.reduce((sum, p) => {
      const analytics = p.analytics as Record<string, number> | null;
      return sum + (analytics?.engagement || 0);
    }, 0);

    const totalImpressions = publishedPosts.reduce((sum, p) => {
      const analytics = p.analytics as Record<string, number> | null;
      return sum + (analytics?.impressions || 0);
    }, 0);

    const avgEngagementRate = totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : '0.00';

    // Calculate total followers from platform connections metadata
    const totalFollowers = platformConnections.reduce((sum, conn) => {
      const metadata = conn.metadata as Record<string, number> | null;
      return sum + (metadata?.followers || 0);
    }, 0);

    // Also check platform metrics for reach
    const totalReach = platformMetrics.reduce((sum, m) => sum + m.reach, 0);

    // Format recent activity
    const recentActivity = recentPostsData.map((post) => ({
      platform: post.platform,
      action: post.status === 'published' ? 'Published content' :
              post.status === 'scheduled' ? 'Scheduled post' : 'Created draft',
      time: (post.publishedAt || post.createdAt).toISOString(),
      engagement: (post.analytics as Record<string, number> | null)?.engagement || 0,
    }));

    // Trending topics (could be calculated from post content/tags)
    const trendingTopics = ['#AI', '#SocialMedia', '#Marketing', '#Growth', '#Automation'];

    const data = {
      stats: {
        totalPosts: totalPostsCount,
        scheduledPosts: scheduledPostsCount,
        totalEngagement,
        totalImpressions,
        avgEngagementRate,
        totalFollowers: totalFollowers || totalReach,
        activeCampaigns: activeCampaignsCount,
        connectedPlatforms: platformConnections.length,
      },
      engagementData: engagementByDay,
      platformData: platformStats,
      recentActivity,
      trendingTopics,
    };

    await cache.set(cacheKey, data, { ttl: 60, tags: [`user:${userId}`] });

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Dashboard stats error:', msg);

    // Surface actionable error for database auth failures
    if (msg.includes('SCRAM') || msg.includes('password') || msg.includes('authentication')) {
      logger.error('[dashboard] DATABASE_URL password is stale — update in Vercel env vars');
      return NextResponse.json(
        { error: 'Database authentication failed', code: 'DB_AUTH_FAILED' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Dashboard temporarily unavailable' },
      { status: 503 }
    );
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
// Allow up to 30s for parallel DB queries before Vercel times out
export const maxDuration = 30;
