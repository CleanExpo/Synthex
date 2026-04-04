/**
 * app/api/dashboard/citation/route.ts
 *
 * Dashboard: Citation tracking — web mentions and backlinks.
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

    let citations: Array<{
      id: string;
      sourceUrl: string;
      sourceDomain: string;
      sourceName: string;
      citedUrl: string;
      anchorText: string;
      domainAuthority: number;
      discoveredAt: Date | string;
      type: string;
    }> = [];

    try {
      const raw =
        (await (
          prisma as unknown as Record<string, unknown> & {
            citation?: {
              findMany: (args: unknown) => Promise<typeof citations>;
            };
          }
        ).citation?.findMany({
          where: { userId },
          orderBy: { discoveredAt: 'desc' },
          take: 100,
        })) ?? [];
      citations = raw;
    } catch {
      // Model may not exist yet
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newThisWeek = citations.filter(
      c => new Date(c.discoveredAt) >= sevenDaysAgo
    ).length;

    const avgDA =
      citations.length > 0
        ? Math.round(
            citations.reduce((sum, c) => sum + (c.domainAuthority ?? 0), 0) /
              citations.length
          )
        : 0;

    const data = {
      totalCitations: citations.length,
      newThisWeek,
      avgDomainAuthority: avgDA,
      citations: citations.map(c => ({
        id: c.id,
        sourceUrl: c.sourceUrl,
        sourceDomain: c.sourceDomain,
        sourceName: c.sourceName ?? c.sourceDomain,
        citedUrl: c.citedUrl,
        anchorText: c.anchorText ?? '',
        domainAuthority: c.domainAuthority ?? 0,
        discoveredAt: new Date(c.discoveredAt).toISOString(),
        type: (c.type as 'backlink' | 'mention' | 'quote') ?? 'mention',
      })),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/citation]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
