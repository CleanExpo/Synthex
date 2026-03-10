/**
 * Sponsors API
 *
 * @description CRUD endpoints for sponsor management.
 *
 * GET /api/sponsors - List sponsors with optional status filter
 * POST /api/sponsors - Create new sponsor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  SponsorStatus,
  SPONSOR_STATUSES,
} from '@/lib/sponsors/sponsor-service';


// =============================================================================
// GET - List Sponsors
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SponsorStatus | null;

    const filters: { status?: SponsorStatus } = {};
    if (status && SPONSOR_STATUSES.includes(status)) {
      filters.status = status;
    }

    const sponsorService = new SponsorService();
    const sponsors = await sponsorService.getSponsors(userId, filters);

    return NextResponse.json({
      success: true,
      data: sponsors,
    });
  } catch (error) {
    logger.error('Sponsors API GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sponsors' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Sponsor
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid name' },
        { status: 400 }
      );
    }

    if (body.status && !SPONSOR_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const sponsor = await sponsorService.createSponsor(userId, {
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
    logger.error('Sponsors API POST error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to create sponsor' },
      { status: 500 }
    );
  }
}
