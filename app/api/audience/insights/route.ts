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
import {
  aggregateConnectionDemographics,
  type ConnectionDemographicsMetadata,
} from '@/lib/analytics/aggregate-demographics';
import {
  AUDIENCE_DEMOGRAPHICS_PLATFORMS,
  syncConnectionAudienceDemographics,
} from '@/lib/analytics/sync-audience-demographics';

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

/** A point on the follower-growth trend the audience page plots. */
interface GrowthPoint {
  date: string; // YYYY-MM-DD
  followers: number; // org total on that day
  gained: number; // increase vs the previous recorded day (>= 0)
  lost: number; // decrease vs the previous recorded day (>= 0)
}

interface GrowthSummary {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: GrowthPoint[];
}

/**
 * Build the real follower-growth series from FollowerSnapshot history.
 *
 * Collapses raw snapshot rows (ordered by capturedAt asc) into one
 * total-followers value per day — latest snapshot per connection per day wins —
 * then derives per-day gained/lost deltas and the earliest-vs-latest summary.
 *
 * The audience page's "Follower Growth" chart plots `followers` and its tooltip
 * reads `followers/gained/lost`; the Growth KPI card reads `change/changePercent`.
 * This returns exactly that contract from REAL history (no fabrication): when
 * fewer than 2 snapshot days exist, the series is whatever we have and the
 * summary delta stays 0 so the UI shows honest "collecting data" rather than a
 * misleading change.
 */
function buildFollowerGrowth(
  rows: Array<{ connectionId: string; followers: number; capturedAt: Date }>,
  fallbackCurrent: number
): GrowthSummary {
  // day -> (connectionId -> latest followers seen that day)
  const byDay = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const day = row.capturedAt.toISOString().slice(0, 10);
    let conns = byDay.get(day);
    if (!conns) {
      conns = new Map<string, number>();
      byDay.set(day, conns);
    }
    // rows are ordered by capturedAt asc, so the last write per connection/day wins
    conns.set(row.connectionId, row.followers);
  }

  const daily = Array.from(byDay.entries())
    .map(([date, conns]) => ({
      date,
      followers: Array.from(conns.values()).reduce((sum, n) => sum + n, 0),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const trend: GrowthPoint[] = daily.map((point, i) => {
    const delta = i === 0 ? 0 : point.followers - daily[i - 1].followers;
    return {
      date: point.date,
      followers: point.followers,
      gained: delta > 0 ? delta : 0,
      lost: delta < 0 ? -delta : 0,
    };
  });

  if (daily.length < 2) {
    // Not enough history for an honest delta — show the current snapshot total
    // (from live connection metadata) but no misleading change.
    return {
      current: daily.length === 1 ? daily[0].followers : fallbackCurrent,
      previous: daily.length === 1 ? daily[0].followers : fallbackCurrent,
      change: 0,
      changePercent: 0,
      trend,
    };
  }

  const previous = daily[0].followers;
  const current = daily[daily.length - 1].followers;
  const change = current - previous;
  const changePercent =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round((change / previous) * 100);

  return { current, previous, change, changePercent, trend };
}

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
    // Refresh button asks the insight APIs to re-populate metadata.demographics
    // (otherwise we only read what the hourly analytics-sync cron last wrote).
    const forceRefresh = searchParams.get('refresh') === '1';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Org-scoped connections (same contract as /api/auth/connections): when an
    // effective org is set, include every active connection for that org — not
    // only rows owned by this userId. Personal/no-org falls back to userId +
    // organizationId:null so we never leak other users' null-org rows.
    const connectionWhere = organizationId
      ? { organizationId, isActive: true }
      : { userId, organizationId: null, isActive: true };

    // Fetch connected platforms (tokens only used when we need to sync demographics)
    const connections = await prisma.platformConnection.findMany({
      where: connectionWhere,
      select: {
        id: true,
        platform: true,
        profileName: true,
        metadata: true,
        lastSync: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
        profileId: true,
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

    // -------------------------------------------------------------------------
    // Demographics population: call existing platform insight APIs when needed.
    // Cron (analytics-sync) is the steady-state writer; this path covers:
    //   - first visit before the hourly cron has run (never synced), and
    //   - explicit Refresh (?refresh=1) from the audience dashboard.
    // Never fabricates — syncConnectionAudienceDemographics persists honest
    // empty arrays when the account doesn't expose demographics.
    // -------------------------------------------------------------------------
    const needsDemographicsSync = (metadata: unknown): boolean => {
      if (!metadata || typeof metadata !== 'object') return true;
      const demo = (metadata as ConnectionDemographicsMetadata).demographics;
      return !demo || typeof demo.syncedAt !== 'string' || !demo.syncedAt;
    };

    const syncTargets = filteredConnections.filter(c => {
      const platform = c.platform.toLowerCase();
      if (!AUDIENCE_DEMOGRAPHICS_PLATFORMS.has(platform)) return false;
      return forceRefresh || needsDemographicsSync(c.metadata);
    });

    if (syncTargets.length > 0) {
      await Promise.all(
        syncTargets.map(async conn => {
          try {
            await syncConnectionAudienceDemographics({
              id: conn.id,
              platform: conn.platform,
              accessToken: conn.accessToken,
              refreshToken: conn.refreshToken,
              expiresAt: conn.expiresAt,
              profileId: conn.profileId,
              profileName: conn.profileName,
            });
          } catch (err) {
            // Helper is designed to resolve on failure; never let a throw abort
            // the insights response.
            logger.warn(
              'audience-insights: demographics sync isolated failure',
              {
                connectionId: conn.id,
                platform: conn.platform,
                error: err instanceof Error ? err.message : String(err),
              }
            );
          }
        })
      );

      // Re-read metadata so aggregation sees what we just persisted.
      const refreshed = await prisma.platformConnection.findMany({
        where: { id: { in: syncTargets.map(c => c.id) } },
        select: { id: true, metadata: true },
        take: 50,
      });
      const byId = new Map(refreshed.map(r => [r.id, r.metadata]));
      for (const conn of filteredConnections) {
        if (byId.has(conn.id)) {
          conn.metadata = byId.get(conn.id) ?? conn.metadata;
        }
      }
    }

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
    // Demographics: aggregate REAL data from each connection's
    // metadata.demographics (written by analytics-sync cron and/or the
    // on-demand sync above via syncConnectionAudienceDemographics). Org-scoped
    // because filteredConnections is already scoped to the effective org. When
    // no connection exposes demographics, aggregateConnectionDemographics
    // returns dataAvailable: false and empty arrays — the UI then shows the
    // honest empty-state.
    // -------------------------------------------------------------------------
    const demographics = aggregateConnectionDemographics(
      filteredConnections.map(
        c => c.metadata as ConnectionDemographicsMetadata | null
      )
    );

    // -------------------------------------------------------------------------
    // Growth: REAL follower-growth-over-time from FollowerSnapshot history (the
    // daily `follower-snapshot` cron). Previously this section emitted a
    // post-derived `{date, postsPublished, totalEngagement}` trend and a
    // hardcoded change:0 — but the audience page plots the chart on `followers`
    // and its tooltip reads `followers/gained/lost`, so the "Follower Growth"
    // section rendered flat with NaN tooltips even when real history existed.
    // We now read the same snapshot history /api/analytics/follower-growth uses,
    // org-scoped (organizationId when present, else userId) and bounded.
    // -------------------------------------------------------------------------
    const snapshotWhere: {
      capturedAt: { gte: Date };
      organizationId?: string;
      userId?: string;
      platform?: string;
    } = { capturedAt: { gte: since } };
    if (organizationId) {
      snapshotWhere.organizationId = organizationId;
    } else {
      snapshotWhere.userId = userId;
    }
    if (platformFilter !== 'all') {
      snapshotWhere.platform = platformFilter.toLowerCase();
    }

    const snapshotRows = await prisma.followerSnapshot.findMany({
      where: snapshotWhere,
      select: { connectionId: true, followers: true, capturedAt: true },
      orderBy: { capturedAt: 'asc' },
      take: 5000, // bounded aggregation query
    });

    const growth = buildFollowerGrowth(snapshotRows, totalFollowers);

    const response = {
      success: true,
      data: {
        demographics,
        behavior: {
          bestPostingTimes,
          activeHours,
          peakDays,
        },
        growth,
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
