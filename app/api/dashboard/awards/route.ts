/**
 * app/api/dashboard/awards/route.ts
 *
 * Dashboard: Awards & Badges — user recognition milestones.
 * Wired to Prisma (Award model) with graceful fallback to empty state.
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

    // Fetch awards for this user
    let awards: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      tier: string;
      earnedAt: Date | string;
    }> = [];

    try {
      const raw =
        (await (
          prisma as unknown as Record<string, unknown> & {
            award?: { findMany: (args: unknown) => Promise<typeof awards> };
          }
        ).award?.findMany({
          where: { userId },
          orderBy: { earnedAt: 'desc' },
          take: 50,
        })) ?? [];
      awards = raw;
    } catch {
      // Model may not exist yet — return empty state
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCount = awards.filter(
      a => new Date(a.earnedAt) >= thirtyDaysAgo
    ).length;

    const data = {
      total: awards.length,
      recentCount,
      awards: awards.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category as
          | 'engagement'
          | 'content'
          | 'growth'
          | 'milestone',
        tier: a.tier as 'bronze' | 'silver' | 'gold' | 'platinum',
        earnedAt: new Date(a.earnedAt).toISOString(),
      })),
      nextMilestone:
        awards.length === 0
          ? {
              title: 'First Post',
              description: 'Publish your first piece of content',
              progress: 0,
              target: 1,
            }
          : undefined,
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/awards]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
