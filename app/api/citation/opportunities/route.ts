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
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getOpportunities } from '@/lib/citation/aggregator';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') ?? userId;

    const data = await getOpportunities(userId, orgId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('[citation/opportunities] Unexpected error', { error });
    return NextResponse.json(
      { error: 'Failed to load citation opportunities' },
      { status: 500 }
    );
  }
}
