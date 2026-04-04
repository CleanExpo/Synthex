/**
 * app/api/dashboard/visuals/route.ts
 *
 * Dashboard: Visual content performance — image/video engagement analytics.
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

    let visuals: Array<{
      id: string;
      type?: string | null;
      platform?: string | null;
      thumbnailUrl?: string | null;
      title?: string | null;
      publishedAt?: Date | string | null;
      views?: number | null;
      engagement?: number | null;
      engagementRate?: number | null;
      saves?: number | null;
      shares?: number | null;
    }> = [];

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findMany: (args: unknown) => Promise<typeof visuals>;
        }
      >;
      visuals =
        (await (
          prismaAny.visualContent ??
          prismaAny.mediaContent ??
          prismaAny.contentMedia
        )?.findMany({
          where: { userId },
          orderBy: { publishedAt: 'desc' },
          take: 50,
        })) ?? [];
    } catch {
      // Model may not exist yet
    }

    const totalVisuals = visuals.length;
    const avgEngagementRate =
      visuals.length > 0
        ? visuals.reduce((s, v) => s + (v.engagementRate ?? 0), 0) /
          visuals.length
        : 0;

    const typeMap: Record<string, number> = {};
    for (const v of visuals) {
      const t = v.type ?? 'image';
      typeMap[t] = (typeMap[t] ?? 0) + 1;
    }

    const data = {
      totalVisuals,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      typeBreakdown: Object.entries(typeMap).map(([type, count]) => ({
        type,
        count,
      })),
      visuals: visuals.map(v => ({
        id: v.id,
        type: (v.type as 'image' | 'video' | 'carousel' | 'reel') ?? 'image',
        platform: v.platform ?? 'unknown',
        thumbnailUrl: v.thumbnailUrl ?? undefined,
        title: v.title ?? undefined,
        publishedAt: v.publishedAt
          ? new Date(v.publishedAt).toISOString()
          : new Date().toISOString(),
        views: v.views ?? 0,
        engagement: v.engagement ?? 0,
        engagementRate: v.engagementRate ?? 0,
        saves: v.saves ?? 0,
        shares: v.shares ?? 0,
      })),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/visuals]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
