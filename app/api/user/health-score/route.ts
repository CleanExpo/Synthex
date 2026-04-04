/**
 * User Health Score API
 *
 * GET /api/user/health-score — returns user engagement health score (0-100)
 * Auth required, user-scoped.
 *
 * UNI-1611
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const healthScore = await prisma.userHealthScore.findUnique({
      where: { userId },
    });

    if (!healthScore) {
      // Return defaults for users without computed scores yet
      return NextResponse.json({
        success: true,
        healthScore: {
          score: 50,
          trend: 'stable',
          riskLevel: 'medium',
          loginScore: 50,
          contentScore: 50,
          featureScore: 50,
          engagementScore: 50,
          growthScore: 50,
          updatedAt: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      healthScore: {
        score: healthScore.score,
        trend: healthScore.trend,
        riskLevel: healthScore.riskLevel,
        loginScore: healthScore.loginScore,
        contentScore: healthScore.contentScore,
        featureScore: healthScore.featureScore,
        engagementScore: healthScore.engagementScore,
        growthScore: healthScore.growthScore,
        updatedAt: healthScore.updatedAt,
      },
    });
  } catch (error) {
    console.error('[User Health Score API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch health score' },
      { status: 500 }
    );
  }
}
