/**
 * Scheduler Stats API
 *
 * GET /api/scheduler/stats
 * Returns publishing pipeline health metrics for the current user:
 * - 7-day totals (published, failed, retrying)
 * - Success rate percentage
 * - Average publish delay (scheduledAt → publishedAt)
 * - Top failure reasons
 * - Next scheduled post info
 * - Current retry queue count
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/scheduler/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface ScheduleHealthStats {
  last7Days: {
    total: number;
    published: number;
    failed: number;
    retrying: number;
    successRate: number;
  };
  averageDelayMinutes: number;
  failureReasons: Array<{ reason: string; count: number }>;
  nextScheduled: {
    count: number;
    nextAt: string | null;
  };
  retryQueue: {
    count: number;
  };
}

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserCampaignIds(userId: string): Promise<string[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });
  return campaigns.map((c) => c.id);
}

// =============================================================================
// GET - Scheduler Health Stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignIds = await getUserCampaignIds(userId);
    if (campaignIds.length === 0) {
      // Return empty stats for users with no campaigns
      const emptyStats: ScheduleHealthStats = {
        last7Days: { total: 0, published: 0, failed: 0, retrying: 0, successRate: 100 },
        averageDelayMinutes: 0,
        failureReasons: [],
        nextScheduled: { count: 0, nextAt: null },
        retryQueue: { count: 0 },
      };
      return NextResponse.json(emptyStats);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const baseCampaignFilter = { campaignId: { in: campaignIds } };

    // -- Parallel queries for 7-day stats ------------------------------------
    const [total, publishedCount, failedCount, scheduledCount, nextScheduledPost, publishedPosts, failedPosts] =
      await Promise.all([
        // Total posts created in last 7 days
        prisma.post.count({
          where: { ...baseCampaignFilter, createdAt: { gte: sevenDaysAgo } },
        }),

        // Published posts in last 7 days
        prisma.post.count({
          where: {
            ...baseCampaignFilter,
            status: 'published',
            publishedAt: { gte: sevenDaysAgo },
          },
        }),

        // Failed posts in last 7 days
        prisma.post.count({
          where: {
            ...baseCampaignFilter,
            status: 'failed',
            updatedAt: { gte: sevenDaysAgo },
          },
        }),

        // Currently scheduled posts (future)
        prisma.post.count({
          where: {
            ...baseCampaignFilter,
            status: 'scheduled',
            scheduledAt: { gte: now },
          },
        }),

        // Next scheduled post
        prisma.post.findFirst({
          where: {
            ...baseCampaignFilter,
            status: 'scheduled',
            scheduledAt: { gte: now },
          },
          orderBy: { scheduledAt: 'asc' },
          select: { scheduledAt: true },
        }),

        // Published posts for delay calculation (limit 100 for perf)
        prisma.post.findMany({
          where: {
            ...baseCampaignFilter,
            status: 'published',
            publishedAt: { gte: sevenDaysAgo },
            scheduledAt: { not: null },
          },
          select: { scheduledAt: true, publishedAt: true },
          take: 100,
        }),

        // Failed posts for reason breakdown
        prisma.post.findMany({
          where: {
            ...baseCampaignFilter,
            status: 'failed',
            updatedAt: { gte: sevenDaysAgo },
          },
          select: { metadata: true },
          take: 50,
        }),
      ]);

    // -- Retry queue count ---------------------------------------------------
    // Posts that are scheduled but have retryCount > 0 in metadata
    // Since Prisma doesn't support JSON path filtering well on all DBs,
    // we query scheduled posts and filter in JS
    const scheduledPostsWithMeta = await prisma.post.findMany({
      where: {
        ...baseCampaignFilter,
        status: 'scheduled',
      },
      select: { metadata: true },
      take: 200,
    });

    const retryingCount = scheduledPostsWithMeta.filter((p) => {
      const meta = p.metadata as Record<string, unknown> | null;
      return meta && typeof meta.retryCount === 'number' && meta.retryCount > 0;
    }).length;

    // -- Average publish delay -----------------------------------------------
    let totalDelayMs = 0;
    let delayCount = 0;
    for (const p of publishedPosts) {
      if (p.publishedAt && p.scheduledAt) {
        const delay = p.publishedAt.getTime() - p.scheduledAt.getTime();
        if (delay >= 0) {
          totalDelayMs += delay;
          delayCount++;
        }
      }
    }
    const avgDelayMinutes = delayCount > 0
      ? Math.round((totalDelayMs / delayCount / 60000) * 10) / 10
      : 0;

    // -- Failure reasons breakdown -------------------------------------------
    const reasonCounts: Record<string, number> = {};
    for (const fp of failedPosts) {
      const meta = fp.metadata as Record<string, unknown> | null;
      const reason = (meta?.publishError as string) ?? 'Unknown error';
      // Normalise long error messages to first 80 chars
      const normalisedReason = reason.length > 80 ? reason.slice(0, 80) + '...' : reason;
      reasonCounts[normalisedReason] = (reasonCounts[normalisedReason] || 0) + 1;
    }
    const failureReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // -- Calculate success rate (published / (published + failed)) -----------
    const completedTotal = publishedCount + failedCount;
    const successRate = completedTotal > 0
      ? Math.round((publishedCount / completedTotal) * 1000) / 10
      : 100;

    // -- Build response ------------------------------------------------------
    const stats: ScheduleHealthStats = {
      last7Days: {
        total,
        published: publishedCount,
        failed: failedCount,
        retrying: retryingCount,
        successRate,
      },
      averageDelayMinutes: avgDelayMinutes,
      failureReasons,
      nextScheduled: {
        count: scheduledCount,
        nextAt: nextScheduledPost?.scheduledAt?.toISOString() ?? null,
      },
      retryQueue: {
        count: retryingCount,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[scheduler/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
