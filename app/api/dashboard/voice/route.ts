/**
 * app/api/dashboard/voice/route.ts
 *
 * Dashboard: Brand voice consistency scoring and content tone analysis.
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

    let voiceScore: {
      overallScore?: number | null;
      trend?: number | null;
      professionalismScore?: number | null;
      authenticityScore?: number | null;
      clarityScore?: number | null;
      consistencyScore?: number | null;
    } | null = null;

    let recentContent: Array<{
      id: string;
      title?: string | null;
      platform?: string | null;
      publishedAt?: Date | string | null;
      voiceScore?: number | null;
      topTones?: unknown;
    }> = [];

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findFirst?: (args: unknown) => Promise<typeof voiceScore>;
          findMany?: (args: unknown) => Promise<typeof recentContent>;
        }
      >;

      voiceScore =
        (await (
          prismaAny.brandVoiceScore ??
          prismaAny.voiceScore ??
          prismaAny.brandVoice
        )?.findFirst?.({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        } as unknown as Record<string, unknown>)) ?? null;

      recentContent =
        (await (
          prismaAny.voiceContentAnalysis ?? prismaAny.contentVoice
        )?.findMany?.({
          where: { userId },
          orderBy: { publishedAt: 'desc' },
          take: 10,
        } as unknown as Record<string, unknown>)) ?? [];
    } catch {
      // Models may not exist yet
    }

    const overall = voiceScore?.overallScore ?? 0;

    const data = {
      overallScore: overall,
      trend: voiceScore?.trend ?? 0,
      dimensions: [
        {
          name: 'Professionalism',
          score: voiceScore?.professionalismScore ?? 0,
          targetScore: 80,
          description: 'Tone appropriate for professional contexts',
        },
        {
          name: 'Authenticity',
          score: voiceScore?.authenticityScore ?? 0,
          targetScore: 85,
          description: 'Genuine, relatable communication style',
        },
        {
          name: 'Clarity',
          score: voiceScore?.clarityScore ?? 0,
          targetScore: 90,
          description: 'Clear, easy-to-understand messaging',
        },
        {
          name: 'Consistency',
          score: voiceScore?.consistencyScore ?? 0,
          targetScore: 75,
          description: 'Consistent brand voice across platforms',
        },
      ],
      recentContent: recentContent.map(c => ({
        id: c.id,
        title: c.title ?? 'Untitled',
        platform: c.platform ?? 'unknown',
        publishedAt: c.publishedAt
          ? new Date(c.publishedAt).toISOString()
          : new Date().toISOString(),
        voiceScore: c.voiceScore ?? 0,
        topTones: Array.isArray(c.topTones) ? c.topTones : [],
      })),
      recommendations:
        overall < 70
          ? [
              'Review your content for consistent tone and vocabulary',
              'Define core brand adjectives and use them consistently',
              'Audit recent posts for off-brand language',
            ]
          : ['Your brand voice is strong — keep publishing consistently'],
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/voice]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
