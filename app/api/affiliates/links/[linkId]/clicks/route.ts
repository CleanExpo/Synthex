/**
 * Affiliate Link Clicks API
 *
 * @description Get click history for an affiliate link.
 *
 * GET /api/affiliates/links/:linkId/clicks - Get click history
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId };
    } catch {
      // Fall through to cookie check
    }
  }

  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId };
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// GET - Get Click History
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
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

    const clicks = await AffiliateLinkService.getLinkClicks(user.id, linkId, dateRange);

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
