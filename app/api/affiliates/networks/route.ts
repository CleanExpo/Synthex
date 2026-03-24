/**
 * Affiliate Networks API
 *
 * @description CRUD endpoints for affiliate network management.
 *
 * GET /api/affiliates/networks - List user's configured networks
 * POST /api/affiliates/networks - Create new network configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  NETWORK_SLUGS,
  type CreateNetworkInput,
  type NetworkSlug,
} from '@/lib/affiliates/affiliate-link-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateNetworkSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.enum(NETWORK_SLUGS as [NetworkSlug, ...NetworkSlug[]]),
  apiKey: z.string().optional(),
  trackingId: z.string().optional(),
  isActive: z.boolean().optional(),
  commissionRate: z.number().nonnegative().optional(),
});

// =============================================================================
// GET - List Networks
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

    const networks = await AffiliateLinkService.listNetworks(userId);

    return NextResponse.json({
      success: true,
      data: networks,
    });
  } catch (error) {
    logger.error('Affiliate Networks API GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch networks' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Network
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

    const parsed = CreateNetworkSchema.safeParse(body);
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

    const input: CreateNetworkInput = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      apiKey: parsed.data.apiKey,
      trackingId: parsed.data.trackingId,
      isActive: parsed.data.isActive,
      commissionRate: parsed.data.commissionRate,
    };

    const network = await AffiliateLinkService.createNetwork(userId, input);

    return NextResponse.json(
      {
        success: true,
        data: network,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Affiliate Networks API POST error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: 'Network with this slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create network' },
      { status: 500 }
    );
  }
}
