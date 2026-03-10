/**
 * Single Deal API
 *
 * @description CRUD endpoints for individual deal.
 *
 * GET /api/sponsors/:id/deals/:dealId - Get deal with deliverables
 * PUT /api/sponsors/:id/deals/:dealId - Update deal
 * DELETE /api/sponsors/:id/deals/:dealId - Delete deal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  DEAL_STAGES,
} from '@/lib/sponsors/sponsor-service';


// =============================================================================
// GET - Single Deal with Deliverables
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dealId } = await params;
    const sponsorService = new SponsorService();
    const deal = await sponsorService.getDeal(dealId, userId);

    if (!deal) {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    logger.error('Deal GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deal' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Deal
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dealId } = await params;
    const body = await request.json();

    // Validate stage if provided
    if (body.stage && !DEAL_STAGES.includes(body.stage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid stage' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const deal = await sponsorService.updateDeal(dealId, userId, {
      title: body.title,
      description: body.description,
      value: body.value,
      currency: body.currency,
      stage: body.stage,
      startDate: body.startDate ? new Date(body.startDate) : body.startDate,
      endDate: body.endDate ? new Date(body.endDate) : body.endDate,
      paidAt: body.paidAt ? new Date(body.paidAt) : body.paidAt,
      revenueEntryId: body.revenueEntryId,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Deal not found') {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }
    logger.error('Deal PUT error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to update deal' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Deal
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dealId } = await params;
    const sponsorService = new SponsorService();
    await sponsorService.deleteDeal(dealId, userId);

    return NextResponse.json({
      success: true,
      message: 'Deal deleted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Deal not found') {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }
    logger.error('Deal DELETE error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to delete deal' },
      { status: 500 }
    );
  }
}
