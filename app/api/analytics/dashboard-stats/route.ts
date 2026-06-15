/**
 * Analytics Dashboard Stats API
 *
 * Returns real post-count metrics for the authenticated user, scoped
 * through the Campaign → Post relationship.  Average engagement is computed
 * from real `post.analytics` engagement-rate data (engagement / impressions),
 * matching the source used by /api/dashboard/stats and /api/analytics/performance.
 * Returns `{ success: true, data }` so consumers can distinguish a real
 * (possibly all-zero) payload from a fetch error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

export interface DashboardStatsData {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  todayPosts: number;
  /** Average engagement rate (%) computed from real post.analytics; 0 when no engagement data exists */
  avgEngagement: number;
  /** Percentage of posts that reached published status */
  successRate: number;
}

/** Response envelope — lets the client tell a real payload apart from a fetch failure */
export interface DashboardStatsResponse {
  success: true;
  data: DashboardStatsData;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve org scope BEFORE the cache read so the key (and tags) are org-scoped.
  // A brand/org switch must never serve another org's cached payload (SYN-908).
  let effectiveOrgId: string | null = null;
  try {
    effectiveOrgId = await getEffectiveOrganizationId(userId);
  } catch {
    // Fall back to user-only scope if org resolution fails
  }

  const cache = getCache();
  const cacheKey = `analytics:dashboard-stats:${userId}:${effectiveOrgId ?? 'self'}`;
  const cached = await cache.get<DashboardStatsResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  }

  try {
    // Resolve all campaign IDs that belong to this user, org-scoped when available
    const campaigns = await prisma.campaign.findMany({
      where: effectiveOrgId
        ? { userId, organizationId: effectiveOrgId }
        : { userId },
      select: { id: true },
      take: 1000,
    });
    const campaignIds = campaigns.map(c => c.id);

    // Midnight boundary for "today" in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Run all counts in parallel — each is a cheap indexed query —
    // plus a pull of published-post analytics for the real engagement-rate calc.
    const [
      totalPosts,
      publishedPosts,
      scheduledPosts,
      draftPosts,
      todayPosts,
      publishedAnalytics,
    ] = await Promise.all([
      prisma.post.count({
        where: { campaignId: { in: campaignIds } },
      }),
      prisma.post.count({
        where: { campaignId: { in: campaignIds }, status: 'published' },
      }),
      prisma.post.count({
        where: { campaignId: { in: campaignIds }, status: 'scheduled' },
      }),
      prisma.post.count({
        where: { campaignId: { in: campaignIds }, status: 'draft' },
      }),
      prisma.post.count({
        where: {
          campaignId: { in: campaignIds },
          createdAt: { gte: today },
        },
      }),
      prisma.post.findMany({
        where: { campaignId: { in: campaignIds }, status: 'published' },
        select: { analytics: true },
        take: 1000,
      }),
    ]);

    const successRate =
      totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0;

    // Real average engagement rate (%) = total engagement / total impressions.
    // Same source as /api/dashboard/stats and /api/analytics/performance
    // (post.analytics.engagement / post.analytics.impressions).
    let sumEngagement = 0;
    let sumImpressions = 0;
    for (const p of publishedAnalytics) {
      const analytics = p.analytics as Record<string, number> | null;
      sumEngagement += analytics?.engagement || 0;
      sumImpressions += analytics?.impressions || 0;
    }
    const avgEngagement =
      sumImpressions > 0
        ? Math.round((sumEngagement / sumImpressions) * 10000) / 100
        : 0;

    const data: DashboardStatsData = {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      draftPosts,
      todayPosts,
      avgEngagement,
      successRate,
    };

    const payload: DashboardStatsResponse = { success: true, data };

    await cache.set(cacheKey, payload, {
      ttl: 300,
      tags: [`user:${userId}`, `org:${effectiveOrgId ?? 'self'}`],
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[analytics/dashboard-stats] Error:', msg);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
