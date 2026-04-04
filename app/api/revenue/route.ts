/**
 * Revenue API
 *
 * @description CRUD endpoints for revenue tracking.
 *
 * GET /api/revenue - List entries with summary
 * POST /api/revenue - Create new entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  RevenueService,
  RevenueSource,
  REVENUE_SOURCES,
} from '@/lib/revenue/revenue-service';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const createRevenueSchema = z.object({
  source: z.enum(REVENUE_SOURCES as [RevenueSource, ...RevenueSource[]]),
  amount: z.number().nonnegative('Amount must be non-negative'),
  paidAt: z.string().min(1, 'Missing paidAt date'),
  currency: z.string().optional(),
  description: z.string().optional(),
  platform: z.string().optional(),
  postId: z.string().optional(),
  brandName: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// GET - List Revenue Entries with Summary
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
    const source = searchParams.get('source') as RevenueSource | null;
    const platform = searchParams.get('platform');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const filters: {
      source?: RevenueSource;
      platform?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (source && REVENUE_SOURCES.includes(source)) {
      filters.source = source;
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

    const revenueService = new RevenueService();
    const [entries, summary] = await Promise.all([
      revenueService.getEntries(userId, filters),
      revenueService.getSummary(userId, filters),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        entries,
        summary,
      },
    });
  } catch (error) {
    logger.error('Revenue API GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Revenue Entry
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

    // Validate request body with Zod
    const parsed = createRevenueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const revenueService = new RevenueService();
    const entry = await revenueService.createEntry(userId, {
      source: data.source,
      amount: data.amount,
      currency: data.currency || 'USD',
      description: data.description,
      platform: data.platform,
      postId: data.postId,
      brandName: data.brandName,
      paidAt: new Date(data.paidAt),
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
      metadata: data.metadata,
    });

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    logger.error('Revenue API POST error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create revenue entry' },
      { status: 500 }
    );
  }
}
