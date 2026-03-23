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
          trend: 0,
          icon: 'dollar' as const,
        },
        {
          label: 'Total Investment',
          value: totalInvestment,
          unit: 'currency' as const,
          trend: 0,
          icon: 'chart' as const,
        },
        {
          label: 'ROI',
          value: overallRoi,
          unit: 'percent' as const,
          trend: 0,
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
