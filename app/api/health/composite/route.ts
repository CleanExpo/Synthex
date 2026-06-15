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
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { computeCompositeHealthScore } from '@/lib/health/composite-score';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Resolve the active brand for multi-business owners (falls back to the
  // user's home organisation, then null) rather than the home org directly —
  // otherwise a brand-switched owner gets a health score for the WRONG brand.
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  try {
    const score = await computeCompositeHealthScore(
      userId,
      organizationId
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
