/**
 * Analytics Dashboard Stats API
 *
 * Returns real post-count metrics for the authenticated user, scoped
 * through the Campaign → Post relationship.  Engagement figures are
 * intentionally reported as 0 until platform APIs are connected and
 * real engagement data is stored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export interface DashboardStatsData {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  todayPosts: number;
  /** Always 0 until platform engagement APIs are wired */
  avgEngagement: number;
  /** Percentage of posts that reached published status */
  successRate: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Resolve all campaign IDs that belong to this user
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);

    // Midnight boundary for "today" in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Run all counts in parallel — each is a cheap indexed query
    const [totalPosts, publishedPosts, scheduledPosts, draftPosts, todayPosts] =
      await Promise.all([
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
      ]);

    const successRate =
      totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0;

    const data: DashboardStatsData = {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      draftPosts,
      todayPosts,
      avgEngagement: 0,
      successRate,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[analytics/dashboard-stats] Error:', msg);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
