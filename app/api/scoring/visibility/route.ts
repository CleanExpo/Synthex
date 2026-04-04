/**
 * GET /api/scoring/visibility
 *
 * Returns latest VisibilityScore + previous week's score for trend.
 * Used by VisibilityScoreWidget on the dashboard homepage.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const [latest, previousWeek] = await Promise.all([
    prisma.visibilityScore.findFirst({
      where: { organizationId },
      orderBy: { calculatedAt: 'desc' },
    }),
    prisma.visibilityScore.findFirst({
      where: {
        organizationId,
        calculatedAt: { lt: new Date(Date.now() - 7 * 86400000) },
      },
      orderBy: { calculatedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    visibilityScore: latest ?? null,
    previousScore: previousWeek?.score ?? null,
    delta: latest && previousWeek ? latest.score - previousWeek.score : null,
  });
}
