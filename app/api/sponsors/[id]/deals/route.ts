/**
 * Sponsor Deals API
 *
 * @description CRUD endpoints for deals within a sponsor.
 *
 * GET /api/sponsors/:id/deals - List deals for sponsor
 * POST /api/sponsors/:id/deals - Create deal for sponsor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  DEAL_STAGES,
} from '@/lib/sponsors/sponsor-service';


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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: sponsorId } = await params;
    const sponsorService = new SponsorService();
    const deals = await sponsorService.getDeals(userId, { sponsorId });

    return NextResponse.json({
      success: true,
      data: deals,
    });
  } catch (error) {
    logger.error('Deals GET error:', { error: error instanceof Error ? error.message : String(error) });
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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: sponsorId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid title' },
        { status: 400 }
      );
    }

    if (typeof body.value !== 'number' || body.value < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid value' },
        { status: 400 }
      );
    }

    if (body.stage && !DEAL_STAGES.includes(body.stage)) {
      return NextResponse.json(
        { success: false, error: 'Invalid stage' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const deal = await sponsorService.createDeal(userId, sponsorId, {
      title: body.title,
      description: body.description,
      value: body.value,
      currency: body.currency,
      stage: body.stage,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      metadata: body.metadata,
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
