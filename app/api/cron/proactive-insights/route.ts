/**
 * Proactive Insights Cron Job
 *
 * GET /api/cron/proactive-insights
 * Runs every 6 hours via Vercel Cron.
 * Checks for anomalies and generates AI PM suggestions for Business users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateProactiveSuggestions } from '@/lib/ai/project-manager';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface DetectedAnomaly {
  userId: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Detect anomalies across all Business users.
 * Checks for engagement spikes/drops, unused features, health declines.
 */
async function detectAnomalies(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Get Business/Custom plan users
  const users = await prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'trialing', 'past_due'] }, // QA-AUDIT-2026-03-14 (M7): include past_due for grace period
      plan: { in: ['business', 'custom'] },
    },
    select: { userId: true },
  });

  for (const user of users) {
    try {
      // Check 1: Health score decline
      const healthScore = await prisma.userHealthScore.findUnique({
        where: { userId: user.userId },
        select: { score: true, trend: true, riskLevel: true },
      });

      if (healthScore && (healthScore.trend === 'declining' || healthScore.riskLevel === 'critical')) {
        anomalies.push({
          userId: user.userId,
          type: 'health_decline',
          data: {
            score: healthScore.score,
            trend: healthScore.trend,
            riskLevel: healthScore.riskLevel,
          },
        });
      }

      // Check 2: Engagement spike on recent posts (top post gets >2x avg engagement)
      const recentMetrics = await prisma.platformMetrics.findMany({
        where: {
          post: { connection: { userId: user.userId } },
          recordedAt: { gte: sixHoursAgo },
        },
        select: {
          likes: true,
          comments: true,
          shares: true,
          engagementRate: true,
          post: { select: { content: true, connection: { select: { platform: true } } } },
        },
        orderBy: { likes: 'desc' },
        take: 5,
      });

      if (recentMetrics.length > 0) {
        const avgLikes = recentMetrics.reduce((s, m) => s + m.likes, 0) / recentMetrics.length;
        const topPost = recentMetrics[0];
        if (topPost.likes > avgLikes * 2 && topPost.likes > 50) {
          anomalies.push({
            userId: user.userId,
            type: 'engagement_spike',
            data: {
              platform: topPost.post.connection.platform,
              content: topPost.post.content.substring(0, 100),
              likes: topPost.likes,
              avgLikes: Math.round(avgLikes),
            },
          });
        }
      }

      // Check 3: Unused high-value features (user has been active 7+ days but never used certain features)
      const streak = await prisma.userStreak.findUnique({
        where: { userId: user.userId },
        select: { totalDays: true },
      });

      if (streak && streak.totalDays >= 7) {
        const usedFeatures = await prisma.analyticsEvent.groupBy({
          by: ['type'],
          where: { userId: user.userId },
        });
        const usedTypes = new Set(usedFeatures.map((e) => e.type));

        const highValueFeatures = [
          'ab_test_created',
          'persona_created',
          'competitor_tracked',
          'schedule_post',
          'analytics_viewed',
        ];

        const unused = highValueFeatures.filter((f) => !usedTypes.has(f));
        if (unused.length > 0) {
          anomalies.push({
            userId: user.userId,
            type: 'unused_feature',
            data: { unusedFeatures: unused.slice(0, 3), totalDaysActive: streak.totalDays },
          });
        }
      }
    } catch (err) {
      logger.error(`[Proactive Insights] Error checking user ${user.userId}:`, err);
    }
  }

  return anomalies;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    logger.info('cron:proactive-insights:start', { timestamp: new Date().toISOString() });

    const anomalies = await detectAnomalies();

    // Group anomalies by user
    const userAnomalies = new Map<string, DetectedAnomaly[]>();
    for (const a of anomalies) {
      const existing = userAnomalies.get(a.userId) || [];
      existing.push(a);
      userAnomalies.set(a.userId, existing);
    }

    let suggestionsGenerated = 0;
    let notificationsSent = 0;

    // Generate AI suggestions per user (max 3 anomalies each)
    for (const [userId, userAnoms] of userAnomalies) {
      try {
        const suggestions = await generateProactiveSuggestions(
          userId,
          userAnoms.map((a) => ({ type: a.type, data: a.data }))
        );

        // Store as notifications
        for (const suggestion of suggestions) {
          await prisma.notification.create({
            data: {
              userId,
              type: suggestion.priority === 'high' ? 'warning' : 'info',
              title: `AI PM: ${suggestion.headline}`,
              message: suggestion.body.substring(0, 500),
              data: {
                source: 'ai_pm_proactive',
                anomalyType: suggestion.type,
                action: suggestion.action,
              },
            },
          });
          notificationsSent++;
        }

        suggestionsGenerated += suggestions.length;
      } catch (err) {
        logger.error(`[Proactive Insights] Failed for user ${userId}:`, err);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:proactive-insights:end', { timestamp: new Date().toISOString(), durationMs: duration, anomaliesDetected: anomalies.length, suggestionsGenerated });

    return NextResponse.json({
      success: true,
      anomaliesDetected: anomalies.length,
      usersAffected: userAnomalies.size,
      suggestionsGenerated,
      notificationsSent,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Proactive Insights Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Proactive insights generation failed' },
      { status: 500 }
    );
  }
}
