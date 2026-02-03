import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }
    const decoded = jwt.default.verify(token, secret) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Try to get user-specific data if authenticated
    const userId = await getUserId(request);

    // Use default 7 days for data range
    const days = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause based on authentication
    const userFilter = userId ? { userId } : {};
    const campaignFilter = userId ? { campaign: { userId } } : {};

    // Fetch real metrics from database
    const [
      totalPostsCount,
      scheduledPostsCount,
      publishedPosts,
      platformConnections,
      platformMetrics,
      recentPostsData,
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

      // Get platform metrics for reach/followers
      prisma.platformMetrics.findMany({
        where: {
          recordedAt: { gte: startDate },
        },
        orderBy: { recordedAt: 'desc' },
        take: 100,
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

    return NextResponse.json({
      stats: {
        totalPosts: totalPostsCount,
        scheduledPosts: scheduledPostsCount,
        totalEngagement,
        totalImpressions,
        avgEngagementRate,
        totalFollowers: totalFollowers || totalReach,
        activeCampaigns: userId ? await prisma.campaign.count({ where: { userId, status: 'active' } }) : 0,
      },
      engagementData: engagementByDay,
      platformData: platformStats,
      recentActivity,
      trendingTopics,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);

    // Return empty data on error - no fallback mock data
    return NextResponse.json({
      stats: {
        totalPosts: 0,
        scheduledPosts: 0,
        totalEngagement: 0,
        totalImpressions: 0,
        avgEngagementRate: '0.00',
        totalFollowers: 0,
        activeCampaigns: 0,
      },
      engagementData: [],
      platformData: [],
      recentActivity: [],
      trendingTopics: [],
      error: 'Failed to fetch dashboard data',
    }, { status: 500 });
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
