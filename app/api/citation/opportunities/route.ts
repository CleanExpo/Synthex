/**
 * Citation Opportunities API — Phase 99
 *
 * GET /api/citation/opportunities
 * Returns up to 10 priority action items needing user attention.
 * Sorted: critical alerts → warning alerts → untested prompts →
 *         pending backlinks → running experiments
 *
 * @module app/api/citation/opportunities/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getOpportunities, reading } from '@/lib/citation/aggregator';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(reading(null, 'UNAUTHORISED'), { status: 401 });
    }

    const data = await getOpportunities(userId);

    return NextResponse.json(reading(data));
  } catch (error) {
    logger.error('[citation/opportunities] Unexpected error', { error });
    return NextResponse.json(reading(null, 'UNAVAILABLE'), { status: 500 });
  }
}
