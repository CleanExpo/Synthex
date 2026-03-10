/**
 * Revenue Entry API
 *
 * @description Single entry operations.
 *
 * GET /api/revenue/[id] - Get single entry
 * PUT /api/revenue/[id] - Update entry
 * DELETE /api/revenue/[id] - Delete entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  RevenueService,
  REVENUE_SOURCES,
} from '@/lib/revenue/revenue-service';


// =============================================================================
// GET - Single Entry
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
    const revenueService = new RevenueService();
    const entry = await revenueService.getEntry(id, userId);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Revenue entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    logger.error('Revenue API GET [id] error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch revenue entry' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Entry
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

    // Validate source if provided
    if (body.source && !REVENUE_SOURCES.includes(body.source)) {
      return NextResponse.json(
        { success: false, error: 'Invalid source' },
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

    const revenueService = new RevenueService();

    try {
      const entry = await revenueService.updateEntry(id, userId, {
        source: body.source,
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        platform: body.platform,
        postId: body.postId,
        brandName: body.brandName,
        paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
        periodStart: body.periodStart !== undefined
          ? body.periodStart ? new Date(body.periodStart) : null
          : undefined,
        periodEnd: body.periodEnd !== undefined
          ? body.periodEnd ? new Date(body.periodEnd) : null
          : undefined,
        metadata: body.metadata,
      });

      return NextResponse.json({
        success: true,
        data: entry,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Revenue entry not found') {
        return NextResponse.json(
          { success: false, error: 'Revenue entry not found' },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error('Revenue API PUT error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to update revenue entry' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Entry
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
    const revenueService = new RevenueService();

    try {
      await revenueService.deleteEntry(id, userId);

      return NextResponse.json({
        success: true,
        message: 'Revenue entry deleted',
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Revenue entry not found') {
        return NextResponse.json(
          { success: false, error: 'Revenue entry not found' },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error('Revenue API DELETE error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to delete revenue entry' },
      { status: 500 }
    );
  }
}
