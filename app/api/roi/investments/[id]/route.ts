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
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  ROIService,
  InvestmentType,
  InvestmentCategory,
  INVESTMENT_TYPES,
  INVESTMENT_CATEGORIES,
} from '@/lib/roi/roi-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateInvestmentSchema = z.object({
  type: z
    .enum(INVESTMENT_TYPES as [InvestmentType, ...InvestmentType[]])
    .optional(),
  category: z
    .enum(
      INVESTMENT_CATEGORIES as [InvestmentCategory, ...InvestmentCategory[]]
    )
    .optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(10).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  platform: z.string().max(100).nullable().optional(),
  postId: z.string().nullable().optional(),
  investedAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Investment API GET [id] error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = UpdateInvestmentSchema.safeParse(body);
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

    const roiService = new ROIService();

    try {
      const investment = await roiService.updateInvestment(id, userId, {
        type: parsed.data.type,
        category: parsed.data.category,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        description: parsed.data.description,
        platform: parsed.data.platform,
        postId: parsed.data.postId,
        investedAt: parsed.data.investedAt
          ? new Date(parsed.data.investedAt)
          : undefined,
        metadata: parsed.data.metadata,
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
    logger.error('Investment API PUT error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Investment API DELETE error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete investment' },
      { status: 500 }
    );
  }
}
