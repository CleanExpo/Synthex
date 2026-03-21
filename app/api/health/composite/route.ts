/**
 * Composite Health Score API
 *
 * GET /api/health/composite — returns 100/100 composite score
 * Auth required, org-scoped.
 *
 * UNI-1610
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { computeCompositeHealthScore } from '@/lib/health/composite-score';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Get user's active organisation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  try {
    const score = await computeCompositeHealthScore(
      userId,
      user.organizationId
    );
    return NextResponse.json({ success: true, score });
  } catch (error) {
    console.error('[Composite Health API]', error);
    return NextResponse.json(
      { error: 'Failed to compute health score' },
      { status: 500 }
    );
  }
}
