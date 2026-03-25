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
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  SponsorStatus,
  SPONSOR_STATUSES,
} from '@/lib/sponsors/sponsor-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateSponsorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  website: z.string().url().nullable().optional(),
  logo: z.string().url().nullable().optional(),
  status: z
    .enum(SPONSOR_STATUSES as [SponsorStatus, ...SponsorStatus[]])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    logger.error('Sponsor GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = UpdateSponsorSchema.safeParse(body);
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
    const sponsor = await sponsorService.updateSponsor(id, userId, {
      name: parsed.data.name,
      company: parsed.data.company,
      email: parsed.data.email,
      phone: parsed.data.phone,
      website: parsed.data.website,
      logo: parsed.data.logo,
      status: parsed.data.status,
      notes: parsed.data.notes,
      metadata: parsed.data.metadata,
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
