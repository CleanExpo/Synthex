/**
 * Investments API
 *
 * @description CRUD endpoints for content investments.
 *
 * GET /api/roi/investments - List investments
 * POST /api/roi/investments - Create investment
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

const CreateInvestmentSchema = z.object({
  type: z.enum(INVESTMENT_TYPES as [InvestmentType, ...InvestmentType[]]),
  category: z.enum(
    INVESTMENT_CATEGORIES as [InvestmentCategory, ...InvestmentCategory[]]
  ),
  amount: z.number().nonnegative(),
  investedAt: z.string().min(1),
  currency: z.string().max(10).optional(),
  description: z.string().max(2000).optional(),
  platform: z.string().max(100).optional(),
  postId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// GET - List Investments
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    const investments = await roiService.getInvestments(userId, filters);

    return NextResponse.json({
      success: true,
      data: investments,
    });
  } catch (error) {
    logger.error('Investments API GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const parsed = CreateInvestmentSchema.safeParse(body);
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
    const investment = await roiService.createInvestment(userId, {
      type: parsed.data.type,
      category: parsed.data.category,
      amount: parsed.data.amount,
      currency: parsed.data.currency || 'USD',
      description: parsed.data.description,
      platform: parsed.data.platform,
      postId: parsed.data.postId,
      investedAt: new Date(parsed.data.investedAt),
      metadata: parsed.data.metadata,
    });

    return NextResponse.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    logger.error('Investments API POST error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create investment' },
      { status: 500 }
    );
  }
}
