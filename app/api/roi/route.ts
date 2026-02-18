/**
 * ROI Report API
 *
 * @description Get ROI calculations and metrics.
 *
 * GET /api/roi - Get ROI report
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { ROIService } from '@/lib/roi/roi-service';

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
// GET - ROI Report
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const filters: {
      platform?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (platform) {
      filters.platform = platform;
    }
    if (startDateStr) {
      filters.startDate = new Date(startDateStr);
    }
    if (endDateStr) {
      filters.endDate = new Date(endDateStr);
    }

    const roiService = new ROIService();
    const report = await roiService.calculateROI(user.id, filters);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('ROI API GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to calculate ROI' },
      { status: 500 }
    );
  }
}
