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
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  RevenueService,
  RevenueSource,
  REVENUE_SOURCES,
} from '@/lib/revenue/revenue-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateRevenueSchema = z.object({
  source: z
    .enum(REVENUE_SOURCES as [RevenueSource, ...RevenueSource[]])
    .optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  description: z.string().max(2000).nullable().optional(),
  platform: z.string().max(100).nullable().optional(),
  postId: z.string().nullable().optional(),
  brandName: z.string().max(200).nullable().optional(),
  paidAt: z.string().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Revenue API GET [id] error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = UpdateRevenueSchema.safeParse(body);
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

    const revenueService = new RevenueService();

    try {
      const entry = await revenueService.updateEntry(id, userId, {
        source: parsed.data.source,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        description: parsed.data.description,
        platform: parsed.data.platform,
        postId: parsed.data.postId,
        brandName: parsed.data.brandName,
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
        periodStart:
          parsed.data.periodStart !== undefined
            ? parsed.data.periodStart
              ? new Date(parsed.data.periodStart)
              : null
            : undefined,
        periodEnd:
          parsed.data.periodEnd !== undefined
            ? parsed.data.periodEnd
              ? new Date(parsed.data.periodEnd)
              : null
            : undefined,
        metadata: parsed.data.metadata,
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
    logger.error('Revenue API PUT error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Revenue API DELETE error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete revenue entry' },
      { status: 500 }
    );
  }
}
