/**
 * createFirstWinNotification
 *
 * Orchestrates the full first-win detection + persistence flow:
 *
 * 1. Check if org has already had their first win detected (idempotency gate)
 * 2. Compute the org's 30-day rolling average for key metrics
 * 3. Check each of the org's recent PlatformPost metrics against the baseline
 * 4. If a win is found:
 *    a. Create a Notification for the org's primary user (type: 'first_win')
 *    b. Set Organization.firstWinDetected = true (prevents future triggers)
 *
 * This function is safe to call repeatedly — it is idempotent.
 *
 * @task SYN-525
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  detectFirstWin,
  formatWinMessage,
  type WinEvent,
  type WinMetric,
} from './detectFirstWin';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_POSTS_LIMIT = 50; // Check the last 50 platform posts for a win

/** Metrics evaluated for first-win detection (in priority order) */
const WIN_METRICS: WinMetric[] = [
  'impressions',
  'reach',
  'engagementRate',
  'clicks',
  'saves',
];

export interface FirstWinResult {
  detected: boolean;
  /** Populated when detected === true */
  win?: WinEvent;
  /** Notification ID created, if detected */
  notificationId?: string;
  /** Why detection was skipped */
  skippedReason?: string;
}

/**
 * Run first-win detection for a single organisation.
 *
 * @param organisationId  The org to check
 * @param primaryUserId   The user to receive the notification (org owner)
 * @param threshold       Override the default 1.3× threshold (optional)
 */
export async function createFirstWinNotification(
  organisationId: string,
  primaryUserId: string,
  threshold?: number
): Promise<FirstWinResult> {
  // ── Idempotency gate ─────────────────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { id: true, firstWinDetected: true },
  });

  if (!org) {
    return { detected: false, skippedReason: 'Organisation not found' };
  }

  if (org.firstWinDetected) {
    return { detected: false, skippedReason: 'First win already detected' };
  }

  // ── Compute 30-day rolling baseline ──────────────────────────────────────
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const baselineAgg = await prisma.platformMetrics.aggregate({
    where: {
      post: {
        connection: { organizationId: organisationId },
      },
      recordedAt: { gte: since },
    },
    _avg: {
      impressions: true,
      reach: true,
      engagementRate: true,
      clicks: true,
      saves: true,
    },
    _count: true,
  });

  // Need at least 3 data points for a meaningful baseline
  if (baselineAgg._count < 3) {
    return {
      detected: false,
      skippedReason: `Insufficient baseline data (${baselineAgg._count} points, need ≥ 3)`,
    };
  }

  const baseline = {
    impressions: baselineAgg._avg.impressions ?? 0,
    reach: baselineAgg._avg.reach ?? 0,
    engagementRate: baselineAgg._avg.engagementRate ?? 0,
    clicks: baselineAgg._avg.clicks ?? 0,
    saves: baselineAgg._avg.saves ?? 0,
  };

  // ── Check recent posts against the baseline ───────────────────────────────
  const recentMetrics = await prisma.platformMetrics.findMany({
    where: {
      post: {
        connection: { organizationId: organisationId },
        status: 'published',
      },
    },
    orderBy: { recordedAt: 'desc' },
    take: RECENT_POSTS_LIMIT,
    select: {
      id: true,
      postId: true,
      impressions: true,
      reach: true,
      engagementRate: true,
      clicks: true,
      saves: true,
      recordedAt: true,
    },
  });

  let detectedWin: WinEvent | null = null;

  outerLoop: for (const metrics of recentMetrics) {
    for (const metric of WIN_METRICS) {
      const actualValue = metrics[metric] as number | null;
      const baselineValue = baseline[metric];

      if (actualValue == null || actualValue <= 0) continue;
      if (baselineValue <= 0) continue;

      const win = detectFirstWin({
        postId: metrics.postId,
        metric,
        actualValue,
        baselineValue,
        threshold,
      });

      if (win) {
        detectedWin = win;
        break outerLoop;
      }
    }
  }

  if (!detectedWin) {
    return { detected: false, skippedReason: 'No posts exceed the threshold' };
  }

  // ── Persist: Notification + org flag ─────────────────────────────────────
  const message = formatWinMessage(detectedWin);

  const [notification] = await prisma.$transaction([
    prisma.notification.create({
      data: {
        userId: primaryUserId,
        type: 'first_win',
        title: '🎉 First Win!',
        message,
        read: false,
        data: {
          postId: detectedWin.postId,
          metric: detectedWin.metric,
          actualValue: detectedWin.actualValue,
          baselineValue: detectedWin.baselineValue,
          improvementPct: detectedWin.improvementPct,
          detectedAt: detectedWin.detectedAt.toISOString(),
        },
      },
    }),
    prisma.organization.update({
      where: { id: organisationId },
      data: { firstWinDetected: true },
    }),
  ]);

  logger.info('notifications:first-win:detected', {
    orgId: organisationId,
    userId: primaryUserId,
    postId: detectedWin.postId,
    metric: detectedWin.metric,
    improvementPct: detectedWin.improvementPct,
    notificationId: notification.id,
  });

  return {
    detected: true,
    win: detectedWin,
    notificationId: notification.id,
  };
}
