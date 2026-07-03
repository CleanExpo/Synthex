/**
 * app/api/dashboard/roi/route.ts
 *
 * Dashboard: ROI calculator and content investment analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');

    let roiRows: Array<{
      platform?: string | null;
      investment?: number | null;
      return?: number | null;
      period?: string | null;
    }> = [];

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findMany: (args: unknown) => Promise<typeof roiRows>;
        }
      >;
      roiRows =
        (await (
          prismaAny.roiMetric ??
          prismaAny.roiMetrics ??
          prismaAny.contentRoi
        )?.findMany({
          where: { userId },
          orderBy: { period: 'desc' },
          take: 12,
        })) ?? [];
    } catch {
      // Model may not exist yet
    }

    const totalInvestment = roiRows.reduce(
      (s, r) => s + (r.investment ?? 0),
      0
    );
    const totalReturn = roiRows.reduce((s, r) => s + (r.return ?? 0), 0);
    const overallRoi =
      totalInvestment > 0
        ? Math.round(((totalReturn - totalInvestment) / totalInvestment) * 100)
        : 0;

    const platformMap: Record<string, { investment: number; return: number }> =
      {};
    for (const r of roiRows) {
      const p = r.platform ?? 'Unknown';
      platformMap[p] = platformMap[p] ?? { investment: 0, return: 0 };
      platformMap[p].investment += r.investment ?? 0;
      platformMap[p].return += r.return ?? 0;
    }

    // Period-over-period trend, computed from roiRows already in memory
    // (ordered period desc). Rows may be per-platform within a period, so
    // group by period and compare the latest two distinct periods.
    const periodTotals = new Map<
      string,
      { investment: number; return: number }
    >();
    const periodOrder: string[] = [];
    for (const r of roiRows) {
      const key = r.period ?? '';
      if (!periodTotals.has(key)) {
        periodTotals.set(key, { investment: 0, return: 0 });
        periodOrder.push(key);
      }
      const t = periodTotals.get(key)!;
      t.investment += r.investment ?? 0;
      t.return += r.return ?? 0;
    }

    const latest = periodOrder[0]
      ? periodTotals.get(periodOrder[0])!
      : { investment: 0, return: 0 };
    const prior = periodOrder[1]
      ? periodTotals.get(periodOrder[1])!
      : undefined;

    // Percentage change vs the prior period. Honest 0 when there is no prior
    // period to compare against (new org / single period of data).
    const pctChange = (current: number, previous: number | undefined) => {
      if (previous === undefined) return 0;
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const latestRoi =
      latest.investment > 0
        ? Math.round(
            ((latest.return - latest.investment) / latest.investment) * 100
          )
        : 0;
    const priorRoi =
      prior && prior.investment > 0
        ? Math.round(
            ((prior.return - prior.investment) / prior.investment) * 100
          )
        : prior
          ? 0
          : undefined;

    const revenueTrend = pctChange(latest.return, prior?.return);
    const investmentTrend = pctChange(latest.investment, prior?.investment);
    const roiTrend = priorRoi === undefined ? 0 : latestRoi - priorRoi; // ROI is already a %, so trend is a point delta

    const data = {
      period: '30 days',
      totalInvestment,
      totalReturn,
      overallRoi,
      metrics: [
        {
          label: 'Total Revenue',
          value: totalReturn,
          unit: 'currency' as const,
          trend: revenueTrend,
          icon: 'dollar' as const,
        },
        {
          label: 'Total Investment',
          value: totalInvestment,
          unit: 'currency' as const,
          trend: investmentTrend,
          icon: 'chart' as const,
        },
        {
          label: 'ROI',
          value: overallRoi,
          unit: 'percent' as const,
          trend: roiTrend,
          icon: 'trend' as const,
        },
      ],
      breakdown: Object.entries(platformMap).map(
        ([platform, { investment, return: ret }]) => ({
          platform,
          investment,
          return: ret,
          roi:
            investment > 0
              ? Math.round(((ret - investment) / investment) * 100)
              : 0,
        })
      ),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/roi]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
