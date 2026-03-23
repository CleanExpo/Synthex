/**
 * app/api/dashboard/experiments/route.ts
 *
 * Dashboard: A/B test and content experiment management.
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

    let experiments: Array<{
      id: string;
      name: string;
      hypothesis?: string | null;
      status: string;
      platform?: string | null;
      startedAt?: Date | string | null;
      endedAt?: Date | string | null;
      variants?: unknown;
    }> = [];

    try {
      const raw =
        (await (
          prisma as unknown as Record<string, unknown> & {
            experiment?: {
              findMany: (args: unknown) => Promise<typeof experiments>;
            };
          }
        ).experiment?.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
          take: 50,
        })) ?? [];
      experiments = raw;
    } catch {
      // Model may not exist yet
    }

    const running = experiments.filter(e => e.status === 'running').length;
    const completed = experiments.filter(e => e.status === 'completed').length;
    const paused = experiments.filter(e => e.status === 'paused').length;

    const data = {
      totalExperiments: experiments.length,
      running,
      completed,
      paused,
      experiments: experiments.map(e => ({
        id: e.id,
        name: e.name,
        hypothesis: e.hypothesis ?? '',
        status:
          (e.status as 'running' | 'completed' | 'paused' | 'draft') ?? 'draft',
        platform: e.platform ?? 'unknown',
        startedAt: e.startedAt
          ? new Date(e.startedAt).toISOString()
          : new Date().toISOString(),
        endedAt: e.endedAt ? new Date(e.endedAt).toISOString() : undefined,
        variants: Array.isArray(e.variants) ? e.variants : [],
      })),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/experiments]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
