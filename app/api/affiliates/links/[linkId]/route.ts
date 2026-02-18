/**
 * Single Affiliate Link API
 *
 * @description CRUD endpoints for individual link management.
 *
 * GET /api/affiliates/links/:linkId - Get link details with analytics
 * PUT /api/affiliates/links/:linkId - Update link
 * DELETE /api/affiliates/links/:linkId - Delete link
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  type UpdateLinkInput,
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
// GET - Get Link
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { linkId } = await params;
    const link = await AffiliateLinkService.getLink(user.id, linkId);

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: link,
    });
  } catch (error) {
    logger.error('Affiliate Link GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch link' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Link
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { linkId } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await AffiliateLinkService.getLink(user.id, linkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    const input: UpdateLinkInput = {
      networkId: body.networkId,
      name: body.name,
      originalUrl: body.originalUrl,
      affiliateUrl: body.affiliateUrl,
      shortCode: body.shortCode,
      productName: body.productName,
      productImage: body.productImage,
      category: body.category,
      tags: body.tags,
      autoInsert: body.autoInsert,
      keywords: body.keywords,
      isActive: body.isActive,
    };

    const link = await AffiliateLinkService.updateLink(user.id, linkId, input);

    return NextResponse.json({
      success: true,
      data: link,
    });
  } catch (error) {
    logger.error('Affiliate Link PUT error:', { error: error instanceof Error ? error.message : String(error) });

    // Handle unique constraint violation for short code
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: 'Short code already in use' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Link
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { linkId } = await params;

    // Verify ownership
    const existing = await AffiliateLinkService.getLink(user.id, linkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    await AffiliateLinkService.deleteLink(user.id, linkId);

    return NextResponse.json({
      success: true,
      message: 'Link deleted successfully',
    });
  } catch (error) {
    logger.error('Affiliate Link DELETE error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
