/**
 * Achievement Tracker
 *
 * Event-driven achievement unlocking. Called after analytics events.
 * Checks conditions against the achievements catalog and unlocks
 * achievements when thresholds are met.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import prisma from '@/lib/prisma';
import { ACHIEVEMENTS_CATALOG, type AchievementDefinition } from './achievements-catalog';

interface CheckResult {
  unlocked: AchievementDefinition[];
  progressed: Array<{ achievement: AchievementDefinition; progress: number }>;
}

/**
 * Check all achievements for a user and unlock any that are newly met.
 * Returns list of newly unlocked achievements (for celebration UI).
 */
export async function checkAndUnlockAchievements(userId: string): Promise<CheckResult> {
  const result: CheckResult = { unlocked: [], progressed: [] };

  // Get already unlocked achievements
  const existingAchievements = await prisma.userAchievement.findMany({
    where: { userId, progress: 100 },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(existingAchievements.map((a) => a.achievementId));

  // Get user metrics for condition checking
  const metrics = await getUserMetrics(userId);

  for (const achievement of ACHIEVEMENTS_CATALOG) {
    if (unlockedIds.has(achievement.id)) continue;

    const currentValue = getMetricValue(metrics, achievement.condition.type);
    const progress = Math.min(100, Math.round((currentValue / achievement.condition.threshold) * 100));

    if (progress >= 100) {
      // Unlock achievement!
      await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: { userId, achievementId: achievement.id },
        },
        create: {
          userId,
          achievementId: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          rarity: achievement.rarity,
          progress: 100,
          unlockedAt: new Date(),
          pointsAwarded: achievement.points,
        },
        update: {
          progress: 100,
          unlockedAt: new Date(),
          pointsAwarded: achievement.points,
        },
      });

      // Award points to streak/level
      await prisma.userStreak.upsert({
        where: { userId },
        create: { userId, points: achievement.points },
        update: { points: { increment: achievement.points } },
      });

      result.unlocked.push(achievement);
    } else if (progress > 0) {
      // Update progress
      await prisma.userAchievement.upsert({
        where: {
          userId_achievementId: { userId, achievementId: achievement.id },
        },
        create: {
          userId,
          achievementId: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          rarity: achievement.rarity,
          progress,
          pointsAwarded: 0,
        },
        update: { progress },
      });

      result.progressed.push({ achievement, progress });
    }
  }

  return result;
}

/**
 * Record a daily streak check. Should be called on each user login/activity.
 */
export async function recordDailyActivity(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  level: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.userStreak.findUnique({
    where: { userId },
  });

  if (!existing) {
    // First ever activity
    const created = await prisma.userStreak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        totalDays: 1,
        lastActiveDate: today,
        level: 1,
        points: 0,
      },
    });
    return { currentStreak: 1, longestStreak: 1, level: 1 };
  }

  const lastActive = existing.lastActiveDate
    ? new Date(existing.lastActiveDate)
    : null;

  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
  }

  const diffDays = lastActive
    ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (diffDays === 0) {
    // Already logged today
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
      level: existing.level,
    };
  }

  let newStreak: number;
  if (diffDays === 1) {
    // Consecutive day — continue streak
    newStreak = existing.currentStreak + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(existing.longestStreak, newStreak);
  const newTotal = existing.totalDays + 1;

  // Level up every 50 points
  const newLevel = Math.max(1, Math.floor(existing.points / 50) + 1);

  const updated = await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongest,
      totalDays: newTotal,
      lastActiveDate: today,
      level: newLevel,
    },
  });

  return {
    currentStreak: updated.currentStreak,
    longestStreak: updated.longestStreak,
    level: updated.level,
  };
}

// ==========================================
// Metric Gathering (Internal)
// ==========================================

interface UserMetrics {
  contentCreated: number;
  platformsPublished: number;
  maxPostEngagement: number;
  totalFollowers: number;
  avgEngagementRate: number;
  currentStreak: number;
  personasCreated: number;
  abTestsCreated: number;
  seoAuditsRun: number;
  competitorsTracked: number;
  postsScheduled: number;
  uniqueFeaturesUsed: number;
  teamInvitesSent: number;
  successfulReferrals: number;
}

async function getUserMetrics(userId: string): Promise<UserMetrics> {
  const [
    contentCount,
    platformsCount,
    maxEngagement,
    avgEngagement,
    streak,
    personaCount,
    abTestCount,
    competitorCount,
    scheduledCount,
    featureCount,
    inviteCount,
    referralCount,
  ] = await Promise.all([
    prisma.platformPost.count({
      where: { connection: { userId } },
    }),
    prisma.platformConnection.groupBy({
      by: ['platform'],
      where: { userId, platformPosts: { some: {} } },
    }).then((r) => r.length),
    prisma.platformMetrics.aggregate({
      where: { post: { connection: { userId } } },
      _max: { likes: true },
    }),
    prisma.platformMetrics.aggregate({
      where: { post: { connection: { userId } } },
      _avg: { engagementRate: true },
    }),
    prisma.userStreak.findUnique({
      where: { userId },
      select: { currentStreak: true },
    }),
    prisma.persona.count({
      where: { userId },
    }),
    prisma.aBTest.count({
      where: { userId },
    }),
    prisma.trackedCompetitor.count({
      where: { userId },
    }),
    prisma.calendarPost.count({
      where: { userId, status: 'scheduled' },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['type'],
      where: { userId },
    }).then((r) => r.length),
    prisma.teamInvitation.count({
      where: { userId },
    }),
    prisma.referral.count({
      where: { referrerId: userId, status: 'converted' },
    }),
  ]);

  return {
    contentCreated: contentCount,
    platformsPublished: platformsCount,
    maxPostEngagement: maxEngagement._max.likes || 0,
    totalFollowers: 0, // Would need aggregation from platform connections
    avgEngagementRate: avgEngagement._avg.engagementRate || 0,
    currentStreak: streak?.currentStreak || 0,
    personasCreated: personaCount,
    abTestsCreated: abTestCount,
    seoAuditsRun: 0, // No direct model, tracked via analytics events
    competitorsTracked: competitorCount,
    postsScheduled: scheduledCount,
    uniqueFeaturesUsed: featureCount,
    teamInvitesSent: inviteCount,
    successfulReferrals: referralCount,
  };
}

function getMetricValue(metrics: UserMetrics, conditionType: string): number {
  const mapping: Record<string, keyof UserMetrics> = {
    content_created: 'contentCreated',
    platforms_published: 'platformsPublished',
    max_post_engagement: 'maxPostEngagement',
    total_followers: 'totalFollowers',
    avg_engagement_rate: 'avgEngagementRate',
    current_streak: 'currentStreak',
    personas_created: 'personasCreated',
    ab_tests_created: 'abTestsCreated',
    seo_audits_run: 'seoAuditsRun',
    competitors_tracked: 'competitorsTracked',
    posts_scheduled: 'postsScheduled',
    unique_features_used: 'uniqueFeaturesUsed',
    team_invites_sent: 'teamInvitesSent',
    successful_referrals: 'successfulReferrals',
  };

  const key = mapping[conditionType];
  return key ? (metrics[key] as number) : 0;
}
