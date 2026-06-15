/**
 * Follower Growth API — real follower-growth-over-time from snapshot history.
 *
 * @description GET: returns the follower time-series + a computed growth delta
 * (latest vs earliest in range) from the `FollowerSnapshot` history the
 * `follower-snapshot` cron records daily. This replaces the analytics growth
 * chart / KPI proxy (postsChange / reach) with real audience-size history.
 *
 * Honest empty-state: when fewer than 2 snapshot days exist for the org, the
 * series is returned as-is and `hasEnoughData` is false so the UI can show a
 * "collecting data" state instead of a misleading delta.
 *
 * Org-scoped: the cache key + tags key by effectiveOrgId (SYN-908), never by
 * userId alone, so a brand switch never serves another org's history.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  platform: z.string().optional(),
});

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

interface FollowerSeriesPoint {
  date: string; // YYYY-MM-DD
  followers: number; // total across the org's connections on that day
}

export interface FollowerGrowthResponse {
  series: FollowerSeriesPoint[];
  growth: {
    current: number;
    previous: number;
    change: number; // current - previous (absolute follower delta)
    changePercent: number; // rounded %
  };
  hasEnoughData: boolean; // >= 2 distinct snapshot days in range
  pointCount: number;
}

const EMPTY_GROWTH = { current: 0, previous: 0, change: 0, changePercent: 0 };

/**
 * Collapse raw snapshot rows into one total-followers value per day, then build
 * the time-series + earliest-vs-latest growth delta. Latest snapshot per
 * connection per day wins (a connection can only contribute once per day).
 */
function buildGrowth(
  rows: Array<{
    connectionId: string;
    followers: number;
    capturedAt: Date;
  }>
): FollowerGrowthResponse {
  if (rows.length === 0) {
    return {
      series: [],
      growth: EMPTY_GROWTH,
      hasEnoughData: false,
      pointCount: 0,
    };
  }

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

  const series: FollowerSeriesPoint[] = Array.from(byDay.entries())
    .map(([date, conns]) => ({
      date,
      followers: Array.from(conns.values()).reduce((sum, n) => sum + n, 0),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const hasEnoughData = series.length >= 2;
  if (!hasEnoughData) {
    return {
      series,
      growth: EMPTY_GROWTH,
      hasEnoughData: false,
      pointCount: series.length,
    };
  }

  const previous = series[0].followers;
  const current = series[series.length - 1].followers;
  const change = current - previous;
  const changePercent =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round((change / previous) * 100);

  return {
    series,
    growth: { current, previous, change, changePercent },
    hasEnoughData: true,
    pointCount: series.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      period: searchParams.get('period') || '30d',
      platform: searchParams.get('platform') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { period, platform } = parsed.data;

    // Resolve org scope BEFORE the cache read so the cache key (and tags) are
    // org-scoped (SYN-908). A brand switch must never serve another org's history.
    let effectiveOrgId: string | null = null;
    try {
      effectiveOrgId = await getEffectiveOrganizationId(userId);
    } catch {
      // Fall back to user-only scoping if business scope fails
    }

    const cache = getCache();
    const cacheKey = `analytics:follower-growth:${userId}:${
      effectiveOrgId ?? 'self'
    }:${period}:${platform ?? 'all'}`;
    const cached = await cache.get<FollowerGrowthResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      });
    }

    const since = new Date();
    since.setDate(since.getDate() - (PERIOD_DAYS[period] ?? 30));

    // Org-scope at the query layer: business connections by org, personal
    // connections by user when no org context exists.
    const where: {
      capturedAt: { gte: Date };
      organizationId?: string;
      userId?: string;
      platform?: string;
    } = { capturedAt: { gte: since } };
    if (effectiveOrgId) {
      where.organizationId = effectiveOrgId;
    } else {
      where.userId = userId;
    }
    if (platform) {
      where.platform = platform;
    }

    const rows = await prisma.followerSnapshot.findMany({
      where,
      select: { connectionId: true, followers: true, capturedAt: true },
      orderBy: { capturedAt: 'asc' },
      take: 5000, // bounded aggregation query
    });

    const data = buildGrowth(rows);

    await cache.set(cacheKey, data, {
      ttl: 300,
      tags: [`user:${userId}`, `org:${effectiveOrgId ?? 'self'}`],
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    logger.error('follower-growth:fatal', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to load follower growth' },
      { status: 500 }
    );
  }
}
