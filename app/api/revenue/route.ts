/**
 * Revenue API
 *
 * @description CRUD endpoints for revenue tracking.
 *
 * GET /api/revenue - List entries with summary
 * POST /api/revenue - Create new entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  RevenueService,
  RevenueSource,
  REVENUE_SOURCES,
} from '@/lib/revenue/revenue-service';

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
// GET - List Revenue Entries with Summary
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
      revenueService.getEntries(user.id, filters),
      revenueService.getSummary(user.id, filters),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        entries,
        summary,
      },
    });
  } catch (error) {
    logger.error('Revenue API GET error:', { error: error instanceof Error ? error.message : String(error) });
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.source || !REVENUE_SOURCES.includes(body.source)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing source' },
        { status: 400 }
      );
    }
    if (typeof body.amount !== 'number' || body.amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }
    if (!body.paidAt) {
      return NextResponse.json(
        { success: false, error: 'Missing paidAt date' },
        { status: 400 }
      );
    }

    const revenueService = new RevenueService();
    const entry = await revenueService.createEntry(user.id, {
      source: body.source,
      amount: body.amount,
      currency: body.currency || 'USD',
      description: body.description,
      platform: body.platform,
      postId: body.postId,
      brandName: body.brandName,
      paidAt: new Date(body.paidAt),
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    logger.error('Revenue API POST error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to create revenue entry' },
      { status: 500 }
    );
  }
}
