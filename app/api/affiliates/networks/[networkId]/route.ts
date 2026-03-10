/**
 * Single Affiliate Network API
 *
 * @description CRUD endpoints for individual network management.
 *
 * GET /api/affiliates/networks/:networkId - Get network details
 * PUT /api/affiliates/networks/:networkId - Update network
 * DELETE /api/affiliates/networks/:networkId - Delete network
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  type UpdateNetworkInput,
} from '@/lib/affiliates/affiliate-link-service';


// =============================================================================
// GET - Get Network
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ networkId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;
    const network = await AffiliateLinkService.getNetwork(userId, networkId);

    if (!network) {
      return NextResponse.json(
        { success: false, error: 'Network not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: network,
    });
  } catch (error) {
    logger.error('Affiliate Network GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch network' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Network
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ networkId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await AffiliateLinkService.getNetwork(userId, networkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Network not found' },
        { status: 404 }
      );
    }

    const input: UpdateNetworkInput = {
      name: body.name,
      apiKey: body.apiKey,
      trackingId: body.trackingId,
      isActive: body.isActive,
      commissionRate: body.commissionRate,
    };

    const network = await AffiliateLinkService.updateNetwork(userId, networkId, input);

    return NextResponse.json({
      success: true,
      data: network,
    });
  } catch (error) {
    logger.error('Affiliate Network PUT error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to update network' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Network
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ networkId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;

    // Verify ownership
    const existing = await AffiliateLinkService.getNetwork(userId, networkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Network not found' },
        { status: 404 }
      );
    }

    await AffiliateLinkService.deleteNetwork(userId, networkId);

    return NextResponse.json({
      success: true,
      message: 'Network deleted successfully',
    });
  } catch (error) {
    logger.error('Affiliate Network DELETE error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to delete network' },
      { status: 500 }
    );
  }
}
