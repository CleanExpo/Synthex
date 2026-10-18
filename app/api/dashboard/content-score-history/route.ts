/**
 * GET /api/dashboard/content-score-history
 *
 * Content Score history for the caller's active brand.
 *
 * NOT PROVISIONED: the `content_score_history` table has no Prisma model, so
 * after auth and brand resolution this returns 503 FEATURE_NOT_PROVISIONED
 * (available:false) instead of a fabricated or empty history.
 *
 * @task SYN-665
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export interface ContentScoreRow {
  score: number;
  delta: number;
  components: {
    data_availability: number;
    engagement_lift: number;
    volume_bonus: number;
  };
  data_points: number;
  week_start: string;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Resolve the active brand for multi-business owners (falls back to the
  // user's home organisation, then null) rather than the home org directly —
  // otherwise a brand-switched owner reads the WRONG brand's score history.
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  return notProvisionedResponse(
    'Content Score history storage is not provisioned',
    {
      available: false,
      reason: 'content_score_history table is not provisioned',
    }
  );
}
