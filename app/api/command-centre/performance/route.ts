/**
 * Command Centre — Performance API
 *
 * GET /api/command-centre/performance
 * Engagement metrics for AI-generated posts over 7d and 30d windows.
 *
 * @module app/api/command-centre/performance/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch published autopilot posts in both windows
  const posts = await prisma.post.findMany({
    where: {
      campaign: { organizationId },
      status: 'published',
      publishedAt: { gte: thirtyDaysAgo },
      deletedAt: null,
    },
    select: {
      id: true,
      platform: true,
      publishedAt: true,
      analytics: true,
      metadata: true,
    },
    take: 1000,
  });

  const autopilotPosts = posts.filter(p => {
    const meta = p.metadata as Record<string, unknown> | null;
    return meta?.source === 'autopilot';
  });

  // Calculate metrics for each window
  const metrics7d = calculateMetrics(
    autopilotPosts.filter(p => p.publishedAt && p.publishedAt >= sevenDaysAgo)
  );
  const metrics30d = calculateMetrics(autopilotPosts);

  // Daily breakdown for sparkline (last 7 days)
  const dailyBreakdown: Array<{
    date: string;
    posts: number;
    avgEngagement: number;
  }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]!;
    const dayPosts = autopilotPosts.filter(p => {
      return p.publishedAt?.toISOString().split('T')[0] === dateStr;
    });
    const dayEngagement =
      dayPosts.length > 0
        ? dayPosts.reduce((s, p) => s + getEngagementRate(p.analytics), 0) /
          dayPosts.length
        : 0;
    dailyBreakdown.push({
      date: dateStr,
      posts: dayPosts.length,
      avgEngagement: dayEngagement,
    });
  }

  return NextResponse.json({
    sevenDay: metrics7d,
    thirtyDay: metrics30d,
    dailyBreakdown,
    totalAutopilotPosts: autopilotPosts.length,
  });
}

function calculateMetrics(posts: Array<{ analytics: unknown }>) {
  if (posts.length === 0) {
    return {
      posts: 0,
      avgEngagement: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
    };
  }

  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalEngagement = 0;

  for (const post of posts) {
    const a = post.analytics as Record<string, unknown> | null;
    totalLikes += Number(a?.likes ?? 0);
    totalComments += Number(a?.comments ?? 0);
    totalShares += Number(a?.shares ?? 0);
    totalEngagement += getEngagementRate(post.analytics);
  }

  return {
    posts: posts.length,
    avgEngagement: Number((totalEngagement / posts.length).toFixed(2)),
    totalLikes,
    totalComments,
    totalShares,
  };
}

function getEngagementRate(analytics: unknown): number {
  const a = analytics as Record<string, unknown> | null;
  const likes = Number(a?.likes ?? 0);
  const comments = Number(a?.comments ?? 0);
  const shares = Number(a?.shares ?? 0);
  const impressions = Number(a?.impressions ?? 1);
  return impressions > 0
    ? ((likes + comments + shares) / impressions) * 100
    : 0;
}
