/**
 * Collect Training Data for Prophet Forecasting
 *
 * Shared helper that collects and aggregates metric data
 * from PlatformMetrics and GEOAnalysis tables into
 * ForecastDataPoint[] for Prophet model training.
 *
 * @module lib/forecasting/collect-training-data
 */

import prisma from '@/lib/prisma';
import type { ForecastDataPoint } from './types';
import { FORECAST_METRICS } from './metrics';
import type { ForecastMetric } from './types';

/**
 * Collect time-series training data for a given metric and optional platform.
 *
 * @param orgId       Organisation ID
 * @param metric      Forecast metric identifier
 * @param platform    Optional platform filter (null = aggregate)
 * @returns           Array of { ds: 'YYYY-MM-DD', y: number }
 */
export async function collectTrainingData(
  orgId: string,
  metric: ForecastMetric,
  platform?: string,
): Promise<ForecastDataPoint[]> {
  const metricDef = FORECAST_METRICS[metric];

  // ─── GEO Analysis Metrics ─────────────────────────────────────────────────

  if (metricDef.dataSource === 'geo_analysis' || metricDef.dataSource === 'authority_analysis') {
    const analyses = await prisma.gEOAnalysis.findMany({
      where: { user: { organizationId: orgId } },
      select: {
        overallScore: true,
        authorityScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date (YYYY-MM-DD), average target field per day
    const byDate: Record<string, { sum: number; count: number }> = {};

    for (const row of analyses) {
      const ds = row.createdAt.toISOString().slice(0, 10);
      const value =
        metric === 'geo_score'
          ? (row.overallScore ?? 0)
          : (row.authorityScore ?? 0);

      if (!byDate[ds]) byDate[ds] = { sum: 0, count: 0 };
      byDate[ds].sum += value;
      byDate[ds].count += 1;
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ds, { sum, count }]) => ({ ds, y: sum / count }));
  }

  // ─── Platform Metrics ─────────────────────────────────────────────────────

  // Resolve active platform connections for this org
  const connections = await prisma.platformConnection.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      ...(platform ? { platform } : {}),
    },
    select: { id: true },
  });

  if (connections.length === 0) return [];

  const connectionIds = connections.map((c) => c.id);

  // Resolve published posts for these connections
  const posts = await prisma.platformPost.findMany({
    where: {
      connectionId: { in: connectionIds },
      status: 'published',
      publishedAt: { not: null },
    },
    select: { id: true },
  });

  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // Fetch platform metrics for these posts
  const metrics = await prisma.platformMetrics.findMany({
    where: { postId: { in: postIds } },
    select: {
      engagementRate: true,
      impressions: true,
      reach: true,
      clicks: true,
      saves: true,   // proxy for conversions
      recordedAt: true,
    },
    orderBy: { recordedAt: 'asc' },
  });

  // Map metric identifier to field value
  function getValue(row: {
    engagementRate: number | null;
    impressions: number | null;
    reach: number | null;
    clicks: number | null;
    saves: number | null;
  }): number {
    switch (metric) {
      case 'engagement_rate':
        return row.engagementRate ?? 0;
      case 'impressions':
        return row.impressions ?? 0;
      case 'reach':
        return row.reach ?? 0;
      case 'clicks':
        return row.clicks ?? 0;
      case 'conversions':
        // saves used as proxy for conversions — closest available field
        return row.saves ?? 0;
      case 'follower_growth':
        // reach used as proxy for follower_growth — closest available field
        return row.reach ?? 0;
      default:
        return 0;
    }
  }

  // Group by date (YYYY-MM-DD), average per day
  const byDate: Record<string, { sum: number; count: number }> = {};

  for (const row of metrics) {
    const ds = row.recordedAt.toISOString().slice(0, 10);
    if (!byDate[ds]) byDate[ds] = { sum: 0, count: 0 };
    byDate[ds].sum += getValue(row);
    byDate[ds].count += 1;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ds, { sum, count }]) => ({ ds, y: sum / count }));
}
