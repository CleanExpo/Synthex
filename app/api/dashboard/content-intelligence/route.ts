/**
 * Content Intelligence Dashboard API — SYN-633
 *
 * GET /api/dashboard/content-intelligence
 *
 * Returns the current org's content intelligence profile for the
 * ContentIntelligenceCard dashboard widget:
 *   - confidenceLevel: 0.0–1.0 (how much org data we have vs industry baseline)
 *   - topTopics: top-3 performing content topics with avg engagement rates
 *   - improvementRate: % improvement vs previous period (null if < 4 weeks data)
 *   - weekCount: how many weeks of improvement tracking data exist
 *   - postCount: total posts analysed
 *
 * The endpoint is read-only and non-fatal — 200 with empty data on any DB error.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import type { TopicScore } from '@/lib/content-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ContentIntelligencePayload {
  hasData: boolean;
  confidenceLevel: number;
  postCount: number;
  topTopics: TopicScore[];
  improvementRate: number | null;
  weekCount: number;
  industry: string;
}

const EMPTY_PAYLOAD: ContentIntelligencePayload = {
  hasData: false,
  confidenceLevel: 0,
  postCount: 0,
  topTopics: [],
  improvementRate: null,
  weekCount: 0,
  industry: 'general',
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
    }

    const organizationId = user.organizationId;

    // Fetch profile + improvement tracking in parallel
    const [profile, tracking] = await Promise.all([
      prisma.contentPerformanceProfile.findUnique({
        where: { organizationId },
        select: {
          confidenceLevel: true,
          topTopics: true,
          postCount: true,
          industryBaseline: { select: { industry: true } },
        },
      }),
      prisma.contentImprovementTracking.findMany({
        where: { organizationId },
        orderBy: { weekStart: 'desc' },
        take: 4,
        select: { improvementRate: true },
      }),
    ]);

    if (!profile) {
      return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
    }

    const weekCount = tracking.length;
    const latestRate = tracking[0]?.improvementRate ?? null;
    // Only surface improvement rate after 4 weeks of positive data (mirrors email logic)
    const improvementRate =
      weekCount >= 4 && latestRate !== null && latestRate > 0 ? latestRate : null;

    const payload: ContentIntelligencePayload = {
      hasData: true,
      confidenceLevel: profile.confidenceLevel,
      postCount: profile.postCount,
      topTopics: (profile.topTopics as unknown as TopicScore[]).slice(0, 3),
      improvementRate,
      weekCount,
      industry: profile.industryBaseline?.industry ?? 'general',
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    logger.error('[ContentIntelligence] Dashboard route error:', err);
    // Non-fatal — return empty rather than error so the card degrades gracefully
    return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
  }
}
