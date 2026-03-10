/**
 * Affiliate Link Clicks API
 *
 * @description Get click history for an affiliate link.
 *
 * GET /api/affiliates/links/:linkId/clicks - Get click history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';


// =============================================================================
// GET - Get Click History
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { linkId } = await params;

    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const clicks = await AffiliateLinkService.getLinkClicks(userId, linkId, dateRange);

    return NextResponse.json({
      success: true,
      data: clicks,
    });
  } catch (error) {
    logger.error('Affiliate Link Clicks GET error:', { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof Error && error.message === 'Link not found') {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch click history' },
      { status: 500 }
    );
  }
}
