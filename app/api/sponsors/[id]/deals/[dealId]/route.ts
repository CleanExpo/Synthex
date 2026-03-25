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
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  DealStage,
  DEAL_STAGES,
} from '@/lib/sponsors/sponsor-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  value: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  stage: z.enum(DEAL_STAGES as [DealStage, ...DealStage[]]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  revenueEntryId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Deal GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { dealId } = await params;
    const body = await request.json();

    const parsed = UpdateDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const deal = await sponsorService.updateDeal(dealId, userId, {
      title: parsed.data.title,
      description: parsed.data.description,
      value: parsed.data.value,
      currency: parsed.data.currency,
      stage: parsed.data.stage,
      startDate:
        parsed.data.startDate === undefined
          ? undefined
          : parsed.data.startDate === null
            ? null
            : new Date(parsed.data.startDate),
      endDate:
        parsed.data.endDate === undefined
          ? undefined
          : parsed.data.endDate === null
            ? null
            : new Date(parsed.data.endDate),
      paidAt:
        parsed.data.paidAt === undefined
          ? undefined
          : parsed.data.paidAt === null
            ? null
            : new Date(parsed.data.paidAt),
      revenueEntryId: parsed.data.revenueEntryId,
      metadata: parsed.data.metadata,
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
