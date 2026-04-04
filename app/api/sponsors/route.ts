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
import { z } from 'zod';
import {
  SponsorService,
  SponsorStatus,
  SPONSOR_STATUSES,
} from '@/lib/sponsors/sponsor-service';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const createSponsorSchema = z.object({
  name: z.string().min(1, 'Missing or invalid name'),
  company: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  logo: z.string().optional(),
  status: z
    .enum(SPONSOR_STATUSES as [SponsorStatus, ...SponsorStatus[]])
    .optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// GET - List Sponsors
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
    logger.error('Sponsors API GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const parsed = createSponsorSchema.safeParse(body);
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

    const sponsorService = new SponsorService();
    const sponsor = await sponsorService.createSponsor(userId, {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      website: data.website,
      logo: data.logo,
      status: data.status,
      notes: data.notes,
      metadata: data.metadata,
    });

    return NextResponse.json({
      success: true,
      data: sponsor,
    });
  } catch (error) {
    logger.error('Sponsors API POST error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create sponsor' },
      { status: 500 }
    );
  }
}
