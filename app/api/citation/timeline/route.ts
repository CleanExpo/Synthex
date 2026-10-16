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
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getTimeline, reading } from '@/lib/citation/aggregator';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(reading(null, 'UNAUTHORISED'), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(
      90,
      Math.max(7, parseInt(searchParams.get('days') ?? '30', 10))
    );

    const data = await getTimeline(userId, days);

    return NextResponse.json(reading(data));
  } catch (error) {
    logger.error('[citation/timeline] Unexpected error', { error });
    return NextResponse.json(reading(null, 'UNAVAILABLE'), { status: 500 });
  }
}
