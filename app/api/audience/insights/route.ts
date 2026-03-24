/**
 * Audience Insights API
 *
 * @description Aggregates audience demographics, behavior patterns,
 * and growth data across all connected platforms.
 *
 * GET /api/audience/insights
 * Query: platform (all|specific), period (7d|30d|90d)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

// Platform configuration
const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  twitter: { name: 'Twitter', color: '#1DA1F2' },
  instagram: { name: 'Instagram', color: '#E4405F' },
  youtube: { name: 'YouTube', color: '#FF0000' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2' },
  facebook: { name: 'Facebook', color: '#1877F2' },
  tiktok: { name: 'TikTok', color: '#000000' },
  pinterest: { name: 'Pinterest', color: '#E60023' },
  reddit: { name: 'Reddit', color: '#FF4500' },
  threads: { name: 'Threads', color: '#000000' },
};

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// =============================================================================
// GET - Audience Insights
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platformFilter = searchParams.get('platform') || 'all';
    const period = searchParams.get('period') || '30d';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Fetch connected platforms
    const connections = await prisma.platformConnection.findMany({
      where: {
        userId: userId,
        organizationId: organizationId ?? null,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        profileName: true,
        metadata: true,
        lastSync: true,
      },
      take: 50,
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          demographics: {
            dataAvailable: false,
            ageRanges: [],
            genderSplit: [],
            topLocations: [],
            topLanguages: [],
          },
          behavior: {
            bestPostingTimes: [],
            activeHours: [],
            peakDays: [],
          },
          growth: {
            current: 0,
            previous: 0,
            change: 0,
            changePercent: 0,
            trend: [],
          },
          platforms: [],
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    // Filter platforms if specific one requested
    const filteredConnections =
      platformFilter === 'all'
        ? connections
        : connections.filter(
            c => c.platform.toLowerCase() === platformFilter.toLowerCase()
          );

    // Collect connection IDs for post queries
    const connectionIds = filteredConnections.map(c => c.id);

    // Calculate total followers from real connection metadata
    let totalFollowers = 0;
    const platformSummaries: Array<{
      id: string;
      name: string;
      color: string;
      followers: number;
    }> = [];

    for (const conn of filteredConnections) {
      const platformId = conn.platform.toLowerCase();
      const config = PLATFORM_CONFIG[platformId];
      if (!config) continue;

      const meta = conn.metadata as Record<string, number> | null;
      const followers = meta?.followers ?? meta?.subscriberCount ?? 0;
      totalFollowers += followers;

      platformSummaries.push({
        id: platformId,
        name: config.name,
        color: config.color,
        followers,
      });
    }

    // -------------------------------------------------------------------------
    // Behavior: aggregate from real published post data
    // -------------------------------------------------------------------------
    const publishedPosts = await prisma.platformPost.findMany({
      where: {
        connectionId: { in: connectionIds },
        status: 'published',
        publishedAt: { gte: since },
        deletedAt: null,
      },
      select: {
        publishedAt: true,
        metrics: {
          select: {
            engagementRate: true,
            likes: true,
            comments: true,
            shares: true,
            views: true,
          },
        },
      },
      take: 500,
    });

    // Build best posting times heatmap (day 0-6 × hour 0-23)
    const heatmap: Record<
      string,
      { totalEngagement: number; postCount: number }
    > = {};
    const hourlyMap: Record<
      number,
      { totalActivity: number; postCount: number }
    > = {};
    const dailyMap: Record<
      number,
      { totalActivity: number; postCount: number }
    > = {};

    for (const post of publishedPosts) {
      if (!post.publishedAt) continue;

      const date = new Date(post.publishedAt);
      const day = date.getDay(); // 0=Sun
      const hour = date.getHours();

      // Compute engagement score for this post
      const metric = post.metrics[0];
      const engagementScore = metric
        ? (metric.engagementRate ?? 0) * 100 +
          metric.likes * 0.5 +
          metric.comments * 2 +
          metric.shares * 3
        : 1;

      const key = `${day}-${hour}`;
      if (!heatmap[key]) heatmap[key] = { totalEngagement: 0, postCount: 0 };
      heatmap[key].totalEngagement += engagementScore;
      heatmap[key].postCount += 1;

      if (!hourlyMap[hour])
        hourlyMap[hour] = { totalActivity: 0, postCount: 0 };
      hourlyMap[hour].totalActivity += engagementScore;
      hourlyMap[hour].postCount += 1;

      if (!dailyMap[day]) dailyMap[day] = { totalActivity: 0, postCount: 0 };
      dailyMap[day].totalActivity += engagementScore;
      dailyMap[day].postCount += 1;
    }

    // Find max for normalisation
    const maxHeatmap = Math.max(
      1,
      ...Object.values(heatmap).map(
        v => v.totalEngagement / Math.max(1, v.postCount)
      )
    );
    const maxHourly = Math.max(
      1,
      ...Object.values(hourlyMap).map(
        v => v.totalActivity / Math.max(1, v.postCount)
      )
    );
    const maxDaily = Math.max(
      1,
      ...Object.values(dailyMap).map(
        v => v.totalActivity / Math.max(1, v.postCount)
      )
    );

    const bestPostingTimes =
      publishedPosts.length > 0
        ? Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 24 }, (_, hour) => {
              const entry = heatmap[`${day}-${hour}`];
              const raw = entry
                ? entry.totalEngagement / Math.max(1, entry.postCount)
                : 0;
              return {
                day,
                hour,
                engagement: Math.round((raw / maxHeatmap) * 100),
              };
            })
          ).flat()
        : [];

    const activeHours =
      publishedPosts.length > 0
        ? Array.from({ length: 24 }, (_, hour) => {
            const entry = hourlyMap[hour];
            const raw = entry
              ? entry.totalActivity / Math.max(1, entry.postCount)
              : 0;
            return { hour, activity: Math.round((raw / maxHourly) * 100) };
          })
        : [];

    const peakDays =
      publishedPosts.length > 0
        ? DAYS_OF_WEEK.map((dayName, index) => {
            const entry = dailyMap[index];
            const raw = entry
              ? entry.totalActivity / Math.max(1, entry.postCount)
              : 0;
            return {
              day: dayName,
              activity: Math.round((raw / maxDaily) * 100),
            };
          })
        : [];

    // -------------------------------------------------------------------------
    // Demographics: not stored in DB — surface dataAvailable: false
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Growth: use current follower totals; historical trend from posts published
    // -------------------------------------------------------------------------
    const growthTrend: Array<{
      date: string;
      postsPublished: number;
      totalEngagement: number;
    }> = [];

    if (publishedPosts.length > 0) {
      // Group posts by date
      const byDate: Record<
        string,
        { postsPublished: number; totalEngagement: number }
      > = {};
      for (const post of publishedPosts) {
        if (!post.publishedAt) continue;
        const dateKey = new Date(post.publishedAt).toISOString().split('T')[0];
        if (!byDate[dateKey])
          byDate[dateKey] = { postsPublished: 0, totalEngagement: 0 };
        byDate[dateKey].postsPublished += 1;
        const metric = post.metrics[0];
        if (metric) {
          byDate[dateKey].totalEngagement +=
            metric.likes + metric.comments + metric.shares + metric.views;
        }
      }
      // Build full date range (last `days` days)
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        const entry = byDate[dateKey] ?? {
          postsPublished: 0,
          totalEngagement: 0,
        };
        growthTrend.push({ date: dateKey, ...entry });
      }
    }

    const response = {
      success: true,
      data: {
        demographics: {
          dataAvailable: false,
          ageRanges: [],
          genderSplit: [],
          topLocations: [],
          topLanguages: [],
        },
        behavior: {
          bestPostingTimes,
          activeHours,
          peakDays,
        },
        growth: {
          current: totalFollowers,
          previous: totalFollowers, // historical follower counts not stored
          change: 0,
          changePercent: 0,
          trend: growthTrend,
        },
        platforms: platformSummaries,
        lastUpdated: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Audience insights API error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audience insights' },
      { status: 500 }
    );
  }
}
