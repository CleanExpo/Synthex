/**
 * Sponsor Deals API
 *
 * @description CRUD endpoints for deals within a sponsor.
 *
 * GET /api/sponsors/:id/deals - List deals for sponsor
 * POST /api/sponsors/:id/deals - Create deal for sponsor
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

const CreateDealSchema = z.object({
  title: z.string().min(1).max(200),
  value: z.number().nonnegative(),
  description: z.string().max(2000).optional(),
  currency: z.string().max(10).optional(),
  stage: z.enum(DEAL_STAGES as [DealStage, ...DealStage[]]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// GET - List Deals for Sponsor
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

    const { id: sponsorId } = await params;
    const sponsorService = new SponsorService();
    const deals = await sponsorService.getDeals(userId, { sponsorId });

    return NextResponse.json({
      success: true,
      data: deals,
    });
  } catch (error) {
    logger.error('Deals GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Deal for Sponsor
// =============================================================================

export async function POST(
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

    const { id: sponsorId } = await params;
    const body = await request.json();

    const parsed = CreateDealSchema.safeParse(body);
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
    const deal = await sponsorService.createDeal(userId, sponsorId, {
      title: parsed.data.title,
      description: parsed.data.description,
      value: parsed.data.value,
      currency: parsed.data.currency,
      stage: parsed.data.stage,
      startDate: parsed.data.startDate
        ? new Date(parsed.data.startDate)
        : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      metadata: parsed.data.metadata,
    });

    return NextResponse.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Sponsor not found') {
      return NextResponse.json(
        { success: false, error: 'Sponsor not found' },
        { status: 404 }
      );
    }
    logger.error('Deals POST error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to create deal' },
      { status: 500 }
    );
  }
}
