/**
 * Investment Entry API
 *
 * @description Single investment operations.
 *
 * GET /api/roi/investments/[id] - Get single investment
 * PUT /api/roi/investments/[id] - Update investment
 * DELETE /api/roi/investments/[id] - Delete investment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  ROIService,
  INVESTMENT_TYPES,
  INVESTMENT_CATEGORIES,
} from '@/lib/roi/roi-service';


// =============================================================================
// GET - Single Investment
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const roiService = new ROIService();
    const investment = await roiService.getInvestment(id, userId);

    if (!investment) {
      return NextResponse.json(
        { success: false, error: 'Investment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    logger.error('Investment API GET [id] error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch investment' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Investment
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate type if provided
    if (body.type && !INVESTMENT_TYPES.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (body.category && !INVESTMENT_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Validate amount if provided
    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount < 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const roiService = new ROIService();

    try {
      const investment = await roiService.updateInvestment(id, userId, {
        type: body.type,
        category: body.category,
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        platform: body.platform,
        postId: body.postId,
        investedAt: body.investedAt ? new Date(body.investedAt) : undefined,
        metadata: body.metadata,
      });

      return NextResponse.json({
        success: true,
        data: investment,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Investment not found') {
        return NextResponse.json(
          { success: false, error: 'Investment not found' },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error('Investment API PUT error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to update investment' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Investment
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const roiService = new ROIService();

    try {
      await roiService.deleteInvestment(id, userId);

      return NextResponse.json({
        success: true,
        message: 'Investment deleted',
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Investment not found') {
        return NextResponse.json(
          { success: false, error: 'Investment not found' },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error('Investment API DELETE error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to delete investment' },
      { status: 500 }
    );
  }
}
