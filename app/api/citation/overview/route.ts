/**
 * Citation Overview API — Phase 99
 *
 * GET /api/citation/overview
 * Returns aggregated stats from all v5.0 GEO & Citation Engine tables.
 *
 * @module app/api/citation/overview/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getOverviewStats } from '@/lib/citation/aggregator';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') ?? userId;

    const data = await getOverviewStats(userId, orgId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('[citation/overview] Unexpected error', { error });
    return NextResponse.json(
      { error: 'Failed to load citation overview' },
      { status: 500 }
    );
  }
}
