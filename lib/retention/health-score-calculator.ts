/**
 * Health Score Calculator
 *
 * Weighted composite score for churn prediction & re-engagement.
 * Score: 0-100 across 5 dimensions.
 *
 * Weights:
 * - Login frequency: 25%
 * - Content creation: 25%
 * - Feature breadth: 20%
 * - Engagement metrics: 20%
 * - Growth trajectory: 10%
 *
 * Risk levels:
 * - 0-30: critical (trigger re-engagement email + notification)
 * - 30-50: high risk
 * - 50-70: medium
 * - 70+: healthy
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import prisma from '@/lib/prisma';

interface HealthScoreInput {
  userId: string;
  daysActive30d: number;        // Days logged in (last 30)
  contentCreated30d: number;    // Posts/content created (last 30)
  uniqueFeatures30d: number;    // Unique features used (last 30)
  avgEngagementRate: number;    // Average engagement rate across posts
  followerGrowthRate: number;   // % change in followers (last 30)
  lastLoginDaysAgo: number;     // Days since last login
}

interface HealthScoreResult {
  score: number;           // 0-100
  trend: string;           // 'improving', 'stable', 'declining', 'critical'
  riskLevel: string;       // 'healthy', 'medium', 'high', 'critical'
  loginScore: number;      // 0-100
  contentScore: number;    // 0-100
  featureScore: number;    // 0-100
  engagementScore: number; // 0-100
  growthScore: number;     // 0-100
}

/**
 * Calculate individual dimension scores and weighted composite.
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  // Login score (25%) — Based on days active and recency
  const loginFrequencyScore = Math.min(100, (input.daysActive30d / 20) * 100); // 20+ days = 100
  const loginRecencyPenalty = Math.max(0, 100 - input.lastLoginDaysAgo * 10); // -10 per day absent
  const loginScore = Math.round(loginFrequencyScore * 0.6 + loginRecencyPenalty * 0.4);

  // Content score (25%) — Based on creation volume
  const contentScore = Math.round(Math.min(100, (input.contentCreated30d / 15) * 100)); // 15+ = 100

  // Feature breadth score (20%) — Based on unique features used
  const totalFeatures = 15; // Approximate total features in Synthex
  const featureScore = Math.round(Math.min(100, (input.uniqueFeatures30d / totalFeatures) * 100));

  // Engagement score (20%) — Based on avg engagement rate
  const engagementScore = Math.round(Math.min(100, (input.avgEngagementRate / 5) * 100)); // 5%+ = 100

  // Growth score (10%) — Based on follower growth
  const growthScore = Math.round(
    Math.min(100, Math.max(0, 50 + input.followerGrowthRate * 10)) // 0% = 50, +5% = 100, -5% = 0
  );

  // Weighted composite
  const score = Math.round(
    loginScore * 0.25 +
    contentScore * 0.25 +
    featureScore * 0.20 +
    engagementScore * 0.20 +
    growthScore * 0.10
  );

  // Determine risk level
  let riskLevel: string;
  if (score >= 70) riskLevel = 'healthy';
  else if (score >= 50) riskLevel = 'medium';
  else if (score >= 30) riskLevel = 'high';
  else riskLevel = 'critical';

  // Trend will be determined by comparing with previous score
  const trend = 'stable'; // Overridden below when we compare

  return {
    score,
    trend,
    riskLevel,
    loginScore,
    contentScore,
    featureScore,
    engagementScore,
    growthScore,
  };
}

/**
 * Calculate and store health score for a single user.
 * Compares with previous score to determine trend.
 */
export async function calculateAndStoreHealthScore(userId: string): Promise<HealthScoreResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Gather metrics in parallel
  const [
    user,
    analyticsEvents,
    contentCount,
    platformMetrics,
    previousScore,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { lastLogin: true },
    }),

    // Unique features + active days
    prisma.analyticsEvent.groupBy({
      by: ['type'],
      where: { userId, timestamp: { gte: thirtyDaysAgo } },
      _count: true,
    }),

    // Content created in last 30 days
    prisma.platformPost.count({
      where: {
        connection: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),

    // Average engagement across recent posts
    prisma.platformMetrics.aggregate({
      where: {
        post: { connection: { userId } },
        recordedAt: { gte: thirtyDaysAgo },
      },
      _avg: { engagementRate: true },
    }),

    // Previous health score for trend comparison
    prisma.userHealthScore.findUnique({
      where: { userId },
      select: { score: true },
    }),
  ]);

  const lastLoginDaysAgo = user?.lastLogin
    ? Math.floor((now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  // Estimate days active from analytics events (rough: count distinct dates)
  const uniqueFeatures = analyticsEvents.map((e) => e.type);
  const totalEvents = analyticsEvents.reduce((sum, e) => sum + e._count, 0);
  const estimatedDaysActive = Math.min(30, Math.round(totalEvents / 5)); // Rough heuristic

  const result = calculateHealthScore({
    userId,
    daysActive30d: estimatedDaysActive,
    contentCreated30d: contentCount,
    uniqueFeatures30d: uniqueFeatures.length,
    avgEngagementRate: platformMetrics._avg.engagementRate || 0,
    followerGrowthRate: 0, // Would need historical data comparison
    lastLoginDaysAgo,
  });

  // Determine trend by comparing with previous score
  if (previousScore) {
    const diff = result.score - previousScore.score;
    if (diff > 5) result.trend = 'improving';
    else if (diff < -5) result.trend = 'declining';
    else if (result.score < 30) result.trend = 'critical';
    else result.trend = 'stable';
  }

  // Upsert health score
  await prisma.userHealthScore.upsert({
    where: { userId },
    create: {
      userId,
      score: result.score,
      trend: result.trend,
      riskLevel: result.riskLevel,
      loginScore: result.loginScore,
      contentScore: result.contentScore,
      featureScore: result.featureScore,
      engagementScore: result.engagementScore,
      growthScore: result.growthScore,
      daysActive: estimatedDaysActive,
      featuresUsed: uniqueFeatures.length,
      contentCreated: contentCount,
      lastLoginDaysAgo,
      calculatedAt: now,
    },
    update: {
      score: result.score,
      trend: result.trend,
      riskLevel: result.riskLevel,
      loginScore: result.loginScore,
      contentScore: result.contentScore,
      featureScore: result.featureScore,
      engagementScore: result.engagementScore,
      growthScore: result.growthScore,
      daysActive: estimatedDaysActive,
      featuresUsed: uniqueFeatures.length,
      contentCreated: contentCount,
      lastLoginDaysAgo,
      calculatedAt: now,
    },
  });

  return result;
}

/**
 * Calculate health scores for all active users.
 * Called by daily cron job at 2 AM UTC.
 */
export async function calculateAllHealthScores(): Promise<{
  processed: number;
  critical: number;
  errors: number;
}> {
  // Get all users with active subscriptions
  const users = await prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
      plan: { not: 'free' },
    },
    select: { userId: true },
  });

  let processed = 0;
  let critical = 0;
  let errors = 0;

  // Process in batches of 10 to avoid overwhelming the DB
  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (u) => {
        const result = await calculateAndStoreHealthScore(u.userId);
        if (result.riskLevel === 'critical') critical++;
        processed++;
        return result;
      })
    );

    // Count errors
    errors += results.filter((r) => r.status === 'rejected').length;
  }

  return { processed, critical, errors };
}
