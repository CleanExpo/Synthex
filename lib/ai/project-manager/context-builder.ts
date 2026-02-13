/**
 * AI PM Context Builder
 *
 * Aggregates user data from multiple Prisma tables into a compressed
 * context snapshot (~1500 tokens) for the AI PM system prompt.
 * Runs 5-8 parallel queries, targeting ~50ms total.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import prisma from '@/lib/prisma';

export interface PMContext {
  user: {
    name: string | null;
    email: string;
    memberSince: string;
    lastLogin: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    aiPostsUsed: number;
    aiPostsLimit: number;
    socialAccountsConnected: number;
    socialAccountsLimit: number;
  };
  platforms: Array<{
    platform: string;
    profileName: string | null;
    isActive: boolean;
  }>;
  recentPosts: Array<{
    platform: string;
    content: string;
    publishedAt: string | null;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number | null;
  }>;
  personas: Array<{
    name: string;
    status: string;
    tone: string;
  }>;
  featureUsage: {
    totalEvents30d: number;
    uniqueFeatures: string[];
  };
  healthScore: {
    score: number;
    trend: string;
    riskLevel: string;
  } | null;
  streak: {
    currentStreak: number;
    longestStreak: number;
    level: number;
    points: number;
  } | null;
  competitors: Array<{
    name: string;
    lastTrackedAt: string | null;
  }>;
  recentActivity: {
    postsCreated7d: number;
    campaignsActive: number;
  };
}

/**
 * Build a compressed context snapshot for the AI PM.
 * All queries use Prisma `select` to minimize payload.
 */
export async function buildPMContext(userId: string): Promise<PMContext> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel for speed (~50ms)
  const [
    user,
    subscription,
    platforms,
    recentPostsRaw,
    personas,
    analyticsCount,
    healthScore,
    streak,
    competitors,
    recentPostCount,
    activeCampaigns,
  ] = await Promise.all([
    // 1. Basic user info
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        createdAt: true,
        lastLogin: true,
      },
    }),

    // 2. Subscription details
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        currentAiPosts: true,
        maxAiPosts: true,
        maxSocialAccounts: true,
      },
    }),

    // 3. Connected platforms
    prisma.platformConnection.findMany({
      where: { userId },
      select: {
        platform: true,
        profileName: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 4. Recent posts with metrics (last 10)
    prisma.platformPost.findMany({
      where: {
        connection: { userId },
        publishedAt: { not: null },
      },
      select: {
        content: true,
        publishedAt: true,
        connection: {
          select: { platform: true },
        },
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            likes: true,
            comments: true,
            shares: true,
            engagementRate: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),

    // 5. Active personas
    prisma.persona.findMany({
      where: { userId, status: { in: ['active', 'training'] } },
      select: {
        name: true,
        status: true,
        tone: true,
      },
      take: 5,
    }),

    // 6. Feature usage (30-day analytics events count + unique types)
    prisma.analyticsEvent.groupBy({
      by: ['type'],
      where: {
        userId,
        timestamp: { gte: thirtyDaysAgo },
      },
      _count: true,
    }),

    // 7. Health score
    prisma.userHealthScore.findUnique({
      where: { userId },
      select: {
        score: true,
        trend: true,
        riskLevel: true,
      },
    }),

    // 8. Streak
    prisma.userStreak.findUnique({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        level: true,
        points: true,
      },
    }),

    // 9. Tracked competitors
    prisma.trackedCompetitor.findMany({
      where: { userId, isActive: true },
      select: {
        name: true,
        lastTrackedAt: true,
      },
      take: 5,
    }),

    // 10. Posts created in last 7 days
    prisma.platformPost.count({
      where: {
        connection: { userId },
        createdAt: { gte: sevenDaysAgo },
      },
    }),

    // 11. Active campaigns
    prisma.campaign.count({
      where: {
        userId,
        status: 'active',
      },
    }),
  ]);

  // Process analytics events into feature usage
  const uniqueFeatures = analyticsCount.map((e) => e.type);
  const totalEvents = analyticsCount.reduce((sum, e) => sum + e._count, 0);

  // Process recent posts with metrics
  const recentPosts = recentPostsRaw.map((post) => {
    const latestMetrics = post.metrics[0];
    return {
      platform: post.connection.platform,
      content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      publishedAt: post.publishedAt?.toISOString() || null,
      likes: latestMetrics?.likes || 0,
      comments: latestMetrics?.comments || 0,
      shares: latestMetrics?.shares || 0,
      engagementRate: latestMetrics?.engagementRate || null,
    };
  });

  return {
    user: {
      name: user?.name || null,
      email: user?.email || '',
      memberSince: user?.createdAt?.toISOString().split('T')[0] || '',
      lastLogin: user?.lastLogin?.toISOString() || null,
    },
    subscription: {
      plan: subscription?.plan || 'free',
      status: subscription?.status || 'inactive',
      aiPostsUsed: subscription?.currentAiPosts || 0,
      aiPostsLimit: subscription?.maxAiPosts || 10,
      socialAccountsConnected: platforms.filter((p) => p.isActive).length,
      socialAccountsLimit: subscription?.maxSocialAccounts || 2,
    },
    platforms,
    recentPosts,
    personas,
    featureUsage: {
      totalEvents30d: totalEvents,
      uniqueFeatures: uniqueFeatures.slice(0, 20), // Cap at 20 for token budget
    },
    healthScore: healthScore
      ? {
          score: healthScore.score,
          trend: healthScore.trend,
          riskLevel: healthScore.riskLevel,
        }
      : null,
    streak: streak
      ? {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          level: streak.level,
          points: streak.points,
        }
      : null,
    competitors: competitors.map((c) => ({
      name: c.name,
      lastTrackedAt: c.lastTrackedAt?.toISOString() || null,
    })),
    recentActivity: {
      postsCreated7d: recentPostCount,
      campaignsActive: activeCampaigns,
    },
  };
}

/**
 * Serialize context to a compact string for system prompt injection.
 * Targets ~1500 tokens for efficient LLM usage.
 */
export function serializeContext(context: PMContext): string {
  return `## User Context Snapshot
**User:** ${context.user.name || 'Unknown'} (${context.user.email})
**Member since:** ${context.user.memberSince}
**Last login:** ${context.user.lastLogin ? new Date(context.user.lastLogin).toLocaleDateString() : 'Unknown'}

**Plan:** ${context.subscription.plan} (${context.subscription.status})
**AI Posts:** ${context.subscription.aiPostsUsed}/${context.subscription.aiPostsLimit === -1 ? 'unlimited' : context.subscription.aiPostsLimit} used this month
**Social Accounts:** ${context.subscription.socialAccountsConnected}/${context.subscription.socialAccountsLimit === -1 ? 'unlimited' : context.subscription.socialAccountsLimit} connected

**Connected Platforms:** ${context.platforms.length > 0 ? context.platforms.map((p) => `${p.platform}${p.profileName ? ` (@${p.profileName})` : ''}${p.isActive ? '' : ' [inactive]'}`).join(', ') : 'None'}

**Active Personas:** ${context.personas.length > 0 ? context.personas.map((p) => `${p.name} (${p.tone}, ${p.status})`).join(', ') : 'None configured'}

**Recent Performance (last 10 posts):**
${context.recentPosts.length > 0 ? context.recentPosts.slice(0, 5).map((p) => `- [${p.platform}] "${p.content}" — ${p.likes} likes, ${p.comments} comments, ${p.shares} shares${p.engagementRate ? `, ${p.engagementRate.toFixed(2)}% engagement` : ''}`).join('\n') : 'No published posts yet'}

**7-Day Activity:** ${context.recentActivity.postsCreated7d} posts created, ${context.recentActivity.campaignsActive} active campaigns
**30-Day Feature Usage:** ${context.featureUsage.totalEvents30d} events across ${context.featureUsage.uniqueFeatures.length} features
${context.featureUsage.uniqueFeatures.length > 0 ? `Features used: ${context.featureUsage.uniqueFeatures.slice(0, 10).join(', ')}` : ''}

${context.healthScore ? `**Health Score:** ${context.healthScore.score}/100 (${context.healthScore.trend}, ${context.healthScore.riskLevel} risk)` : '**Health Score:** Not calculated yet'}
${context.streak ? `**Streak:** ${context.streak.currentStreak} days current (longest: ${context.streak.longestStreak}), Level ${context.streak.level}, ${context.streak.points} points` : '**Streak:** Not started'}

**Tracked Competitors:** ${context.competitors.length > 0 ? context.competitors.map((c) => c.name).join(', ') : 'None tracked'}`;
}
