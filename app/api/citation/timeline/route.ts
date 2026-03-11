/**
 * Citation Timeline API — Phase 99
 *
 * GET /api/citation/timeline?days=30
 * Returns time-series data for the last N days (max 90).
 * Each point: { date, geoScore, qualityScore, alertCount }
 *
 * @module app/api/citation/timeline/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getTimeline } from '@/lib/citation/aggregator';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') ?? userId;
    const days = Math.min(
      90,
      Math.max(7, parseInt(searchParams.get('days') ?? '30', 10))
    );

    const data = await getTimeline(userId, orgId, days);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('[citation/timeline] Unexpected error', { error });
    return NextResponse.json(
      { error: 'Failed to load citation timeline' },
      { status: 500 }
    );
  }
}
