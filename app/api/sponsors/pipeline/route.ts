/**
 * Pipeline Summary API
 *
 * @description Get sponsor pipeline summary with deal counts by stage.
 *
 * GET /api/sponsors/pipeline - Pipeline summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { SponsorService } from '@/lib/sponsors/sponsor-service';


// =============================================================================
// GET - Pipeline Summary
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sponsorService = new SponsorService();
    const pipeline = await sponsorService.getPipelineSummary(userId);

    return NextResponse.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    logger.error('Pipeline GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline summary' },
      { status: 500 }
    );
  }
}
