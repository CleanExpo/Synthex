/**
 * Auto-Research Insights API
 * GET /api/auto-research/insights?platform=&category=&limit=
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get('platform') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  try {
    const now = new Date();
    const insights = await prisma.trendInsight.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(category ? { category } : {}),
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        AND: [
          {
            OR: [
              { organizationId: null },
              ...(orgId ? [{ organizationId: orgId }] : []),
            ],
          },
        ],
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        platform: true,
        category: true,
        insight: true,
        confidence: true,
        dataPoints: true,
        validUntil: true,
        applied: true,
        organizationId: true,
        createdAt: true,
        runId: true,
      },
    });

    return NextResponse.json({ insights, total: insights.length });
  } catch (err) {
    logger.error('auto-research insights GET failed', { error: err });
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
