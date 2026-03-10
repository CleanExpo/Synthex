/**
 * Single Sponsor API
 *
 * @description CRUD endpoints for individual sponsor.
 *
 * GET /api/sponsors/:id - Get sponsor with deals
 * PUT /api/sponsors/:id - Update sponsor
 * DELETE /api/sponsors/:id - Delete sponsor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  SPONSOR_STATUSES,
} from '@/lib/sponsors/sponsor-service';


// =============================================================================
// GET - Single Sponsor with Deals
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
    const sponsorService = new SponsorService();
    const sponsor = await sponsorService.getSponsor(id, userId);

    if (!sponsor) {
      return NextResponse.json(
        { success: false, error: 'Sponsor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sponsor,
    });
  } catch (error) {
    logger.error('Sponsor GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sponsor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Sponsor
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

    // Validate status if provided
    if (body.status && !SPONSOR_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const sponsor = await sponsorService.updateSponsor(id, userId, {
      name: body.name,
      company: body.company,
      email: body.email,
      phone: body.phone,
      website: body.website,
      logo: body.logo,
      status: body.status,
      notes: body.notes,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: sponsor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Sponsor not found') {
      return NextResponse.json(
        { success: false, error: 'Sponsor not found' },
        { status: 404 }
      );
    }
    logger.error('Sponsor PUT error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to update sponsor' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Sponsor
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
    const sponsorService = new SponsorService();
    await sponsorService.deleteSponsor(id, userId);

    return NextResponse.json({
      success: true,
      message: 'Sponsor deleted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Sponsor not found') {
      return NextResponse.json(
        { success: false, error: 'Sponsor not found' },
        { status: 404 }
      );
    }
    logger.error('Sponsor DELETE error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to delete sponsor' },
      { status: 500 }
    );
  }
}
