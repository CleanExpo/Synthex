/**
 * Affiliate Networks API
 *
 * @description CRUD endpoints for affiliate network management.
 *
 * GET /api/affiliates/networks - List user's configured networks
 * POST /api/affiliates/networks - Create new network configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  NETWORK_SLUGS,
  type CreateNetworkInput,
  type NetworkSlug,
} from '@/lib/affiliates/affiliate-link-service';

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
// GET - List Networks
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const networks = await AffiliateLinkService.listNetworks(user.id);

    return NextResponse.json({
      success: true,
      data: networks,
    });
  } catch (error) {
    logger.error('Affiliate Networks API GET error:', { error: error instanceof Error ? error.message : String(error) });
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.slug || !NETWORK_SLUGS.includes(body.slug as NetworkSlug)) {
      return NextResponse.json(
        { success: false, error: 'Valid network slug is required' },
        { status: 400 }
      );
    }

    const input: CreateNetworkInput = {
      name: body.name,
      slug: body.slug,
      apiKey: body.apiKey,
      trackingId: body.trackingId,
      isActive: body.isActive,
      commissionRate: body.commissionRate,
    };

    const network = await AffiliateLinkService.createNetwork(user.id, input);

    return NextResponse.json({
      success: true,
      data: network,
    }, { status: 201 });
  } catch (error) {
    logger.error('Affiliate Networks API POST error:', { error: error instanceof Error ? error.message : String(error) });

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
