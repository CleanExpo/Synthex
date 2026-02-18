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
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  type UpdateNetworkInput,
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
// GET - Get Network
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ networkId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;
    const network = await AffiliateLinkService.getNetwork(user.id, networkId);

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await AffiliateLinkService.getNetwork(user.id, networkId);
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

    const network = await AffiliateLinkService.updateNetwork(user.id, networkId, input);

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { networkId } = await params;

    // Verify ownership
    const existing = await AffiliateLinkService.getNetwork(user.id, networkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Network not found' },
        { status: 404 }
      );
    }

    await AffiliateLinkService.deleteNetwork(user.id, networkId);

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
