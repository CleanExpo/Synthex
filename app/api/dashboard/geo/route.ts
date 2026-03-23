/**
 * app/api/dashboard/geo/route.ts
 *
 * Dashboard: Geographic audience distribution.
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

    let geoRows: Array<{
      country?: string | null;
      countryCode?: string | null;
      city?: string | null;
      sessions?: number | null;
      users?: number | null;
      pageviews?: number | null;
      avgSessionDuration?: number | null;
      bounceRate?: number | null;
    }> = [];

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findMany: (args: unknown) => Promise<typeof geoRows>;
        }
      >;
      geoRows =
        (await (
          prismaAny.geoAnalytics ??
          prismaAny.analyticsGeo ??
          prismaAny.geoData
        )?.findMany({
          where: { userId },
          orderBy: { sessions: 'desc' },
          take: 50,
        })) ?? [];
    } catch {
      // Model may not exist yet
    }

    const totalSessions = geoRows.reduce(
      (sum, r) => sum + (r.sessions ?? 0),
      0
    );

    const topRegions = geoRows.map(r => ({
      country: r.country ?? 'Unknown',
      countryCode: r.countryCode ?? 'XX',
      city: r.city ?? undefined,
      sessions: r.sessions ?? 0,
      users: r.users ?? 0,
      pageviews: r.pageviews ?? 0,
      avgSessionDuration: r.avgSessionDuration ?? 0,
      bounceRate: r.bounceRate ?? 0,
      percentOfTotal:
        totalSessions > 0
          ? Math.round(((r.sessions ?? 0) / totalSessions) * 100)
          : 0,
    }));

    const continentMap: Record<string, number> = {};
    for (const r of topRegions) {
      const continent = getContinentFromCode(r.countryCode);
      continentMap[continent] = (continentMap[continent] ?? 0) + r.sessions;
    }

    const data = {
      totalCountries: new Set(geoRows.map(r => r.countryCode).filter(Boolean))
        .size,
      totalCities: new Set(geoRows.map(r => r.city).filter(Boolean)).size,
      topRegions,
      continentBreakdown: Object.entries(continentMap).map(
        ([continent, sessions]) => ({
          continent,
          sessions,
          percentOfTotal:
            totalSessions > 0
              ? Math.round((sessions / totalSessions) * 100)
              : 0,
        })
      ),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/geo]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getContinentFromCode(code: string): string {
  const map: Record<string, string> = {
    US: 'North America',
    CA: 'North America',
    MX: 'North America',
    GB: 'Europe',
    DE: 'Europe',
    FR: 'Europe',
    IT: 'Europe',
    ES: 'Europe',
    NL: 'Europe',
    SE: 'Europe',
    NO: 'Europe',
    PL: 'Europe',
    CH: 'Europe',
    AU: 'Oceania',
    NZ: 'Oceania',
    CN: 'Asia',
    JP: 'Asia',
    KR: 'Asia',
    IN: 'Asia',
    SG: 'Asia',
    ID: 'Asia',
    BR: 'South America',
    AR: 'South America',
    CL: 'South America',
    ZA: 'Africa',
    NG: 'Africa',
    KE: 'Africa',
  };
  return map[code] ?? 'Other';
}
