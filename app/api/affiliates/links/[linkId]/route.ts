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
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  type UpdateLinkInput,
} from '@/lib/affiliates/affiliate-link-service';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateLinkSchema = z.object({
  networkId: z.string().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  originalUrl: z.string().url().optional(),
  affiliateUrl: z.string().url().optional(),
  shortCode: z.string().max(50).nullable().optional(),
  productName: z.string().max(200).nullable().optional(),
  productImage: z.string().url().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  autoInsert: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// GET - Get Link
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { linkId } = await params;
    const link = await AffiliateLinkService.getLink(userId, linkId);

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
    logger.error('Affiliate Link GET error:', {
      error: error instanceof Error ? error.message : String(error),
    });
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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { linkId } = await params;
    const body = await request.json();

    const parsed = UpdateLinkSchema.safeParse(body);
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

    // Verify ownership
    const existing = await AffiliateLinkService.getLink(userId, linkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    const input: UpdateLinkInput = {
      networkId: parsed.data.networkId,
      name: parsed.data.name,
      originalUrl: parsed.data.originalUrl,
      affiliateUrl: parsed.data.affiliateUrl,
      shortCode: parsed.data.shortCode,
      productName: parsed.data.productName,
      productImage: parsed.data.productImage,
      category: parsed.data.category,
      tags: parsed.data.tags,
      autoInsert: parsed.data.autoInsert,
      keywords: parsed.data.keywords,
      isActive: parsed.data.isActive,
    };

    const link = await AffiliateLinkService.updateLink(userId, linkId, input);

    return NextResponse.json({
      success: true,
      data: link,
    });
  } catch (error) {
    logger.error('Affiliate Link PUT error:', {
      error: error instanceof Error ? error.message : String(error),
    });

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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { linkId } = await params;

    // Verify ownership
    const existing = await AffiliateLinkService.getLink(userId, linkId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    await AffiliateLinkService.deleteLink(userId, linkId);

    return NextResponse.json({
      success: true,
      message: 'Link deleted successfully',
    });
  } catch (error) {
    logger.error('Affiliate Link DELETE error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
