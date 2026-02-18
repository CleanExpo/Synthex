/**
 * Investments API
 *
 * @description CRUD endpoints for content investments.
 *
 * GET /api/roi/investments - List investments
 * POST /api/roi/investments - Create investment
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  ROIService,
  InvestmentType,
  InvestmentCategory,
  INVESTMENT_TYPES,
  INVESTMENT_CATEGORIES,
} from '@/lib/roi/roi-service';

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
// GET - List Investments
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as InvestmentType | null;
    const category = searchParams.get('category') as InvestmentCategory | null;
    const platform = searchParams.get('platform');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const filters: {
      type?: InvestmentType;
      category?: InvestmentCategory;
      platform?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (type && INVESTMENT_TYPES.includes(type)) {
      filters.type = type;
    }
    if (category && INVESTMENT_CATEGORIES.includes(category)) {
      filters.category = category;
    }
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
    const investments = await roiService.getInvestments(user.id, filters);

    return NextResponse.json({
      success: true,
      data: investments,
    });
  } catch (error) {
    logger.error('Investments API GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Investment
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.type || !INVESTMENT_TYPES.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing type' },
        { status: 400 }
      );
    }
    if (!body.category || !INVESTMENT_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing category' },
        { status: 400 }
      );
    }
    if (typeof body.amount !== 'number' || body.amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }
    if (!body.investedAt) {
      return NextResponse.json(
        { success: false, error: 'Missing investedAt date' },
        { status: 400 }
      );
    }

    const roiService = new ROIService();
    const investment = await roiService.createInvestment(user.id, {
      type: body.type,
      category: body.category,
      amount: body.amount,
      currency: body.currency || 'USD',
      description: body.description,
      platform: body.platform,
      postId: body.postId,
      investedAt: new Date(body.investedAt),
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    logger.error('Investments API POST error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to create investment' },
      { status: 500 }
    );
  }
}
