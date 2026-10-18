/**
 * GET /api/dashboard/geo-score
 *
 * GEO score for the authenticated user.
 *
 * NOT PROVISIONED: the `client_geo_scores` table has no Prisma model, so after
 * auth this returns 501 FEATURE_NOT_PROVISIONED with an UNSUPPORTED reading.
 *
 * SYN-657
 */

import { notObserved } from '@/lib/ree/evidence-state';
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    {
      ...notObserved(
        'UNSUPPORTED',
        'client_geo_scores',
        'Legacy GEO score storage is not available'
      ),
      error: 'FEATURE_NOT_PROVISIONED',
      message: 'GEO score storage is not provisioned',
      available: false,
    },
    { status: 501 }
  );
}
