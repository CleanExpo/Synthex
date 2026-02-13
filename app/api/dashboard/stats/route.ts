import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserId(request: NextRequest): Promise<string | null> {
  // Check Authorization header OR auth-token cookie
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('auth-token')?.value;

  let token: string | null = null;

  if (authHeader) {
    token = authHeader.replace('Bearer ', '');
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) return null;

  try {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }
    const decoded = jwt.default.verify(token, secret) as { userId?: string; sub?: string };
    return decoded.userId || decoded.sub || null;
  } catch {
    return null;
  }
}

// Demo user stats for when database is unavailable
const DEMO_STATS = {
  stats: {
    totalPosts: 47,
    scheduledPosts: 12,
    totalEngagement: 15420,
    totalImpressions: 245000,
    avgEngagementRate: '6.29',
    totalFollowers: 12500,
    activeCampaigns: 3,
  },
  engagementData: [
    { name: 'Mon', value: 1200 },
    { name: 'Tue', value: 1850 },
    { name: 'Wed', value: 2100 },
    { name: 'Thu', value: 1950 },
    { name: 'Fri', value: 2800 },
    { name: 'Sat', value: 3200 },
    { name: 'Sun', value: 2320 },
  ],
  platformData: [
    { platform: 'Twitter', posts: 18, engagement: 4200 },
    { platform: 'LinkedIn', posts: 12, engagement: 5800 },
    { platform: 'Instagram', posts: 10, engagement: 3100 },
    { platform: 'TikTok', posts: 5, engagement: 1800 },
    { platform: 'Facebook', posts: 2, engagement: 520 },
  ],
  recentActivity: [
    { platform: 'Twitter', action: 'Published content', time: new Date().toISOString(), engagement: 342 },
    { platform: 'LinkedIn', action: 'Scheduled post', time: new Date(Date.now() - 3600000).toISOString(), engagement: 0 },
    { platform: 'Instagram', action: 'Published content', time: new Date(Date.now() - 7200000).toISOString(), engagement: 521 },
  ],
  trendingTopics: ['#AI', '#SocialMedia', '#Marketing', '#Growth', '#Automation'],
};

export async function GET(request: NextRequest) {
  try {
    // Try to get user-specific data if authenticated
    const userId = await getUserId(request);

    // Return demo stats for demo user (bypasses database)
    if (userId === 'demo-user-001') {
      return NextResponse.json(DEMO_STATS);
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

    // Return demo stats when database is unavailable (graceful degradation)
    return NextResponse.json({
      ...DEMO_STATS,
      _notice: 'Using demo data - database temporarily unavailable',
    });
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
