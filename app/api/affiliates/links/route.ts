/**
 * Affiliate Links API
 *
 * @description CRUD endpoints for affiliate link management.
 *
 * GET /api/affiliates/links - List links with optional filters
 * POST /api/affiliates/links - Create new affiliate link
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  AffiliateLinkService,
  type CreateLinkInput,
  type LinkFilters,
} from '@/lib/affiliates/affiliate-link-service';

// ── Validation ───────────────────────────────────────────────────────────────

const createLinkSchema = z.object({
  name: z.string().min(1).max(255),
  originalUrl: z.string().url().max(2048),
  affiliateUrl: z.string().url().max(2048),
  networkId: z.string().max(255).optional(),
  shortCode: z.string().max(100).optional(),
  productName: z.string().max(255).optional(),
  productImage: z.string().url().max(2048).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(100)).optional(),
  autoInsert: z.boolean().optional(),
  keywords: z.array(z.string().max(100)).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// GET - List Links
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('networkId');
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const autoInsertOnly = searchParams.get('autoInsertOnly') === 'true';

    const filters: LinkFilters = {};
    if (networkId) filters.networkId = networkId;
    if (category) filters.category = category;
    if (activeOnly) filters.activeOnly = true;
    if (autoInsertOnly) filters.autoInsertOnly = true;

    const links = await AffiliateLinkService.listLinks(userId, filters);

    return NextResponse.json({
      success: true,
      data: links,
    });
  } catch (error) {
    logger.error('Affiliate Links API GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Link
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = createLinkSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input: CreateLinkInput = parsed.data;

    const link = await AffiliateLinkService.createLink(userId, input);

    return NextResponse.json({
      success: true,
      data: link,
    }, { status: 201 });
  } catch (error) {
    logger.error('Affiliate Links API POST error:', { error: error instanceof Error ? error.message : String(error) });

    // Handle unique constraint violation for short code
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: 'Short code already in use' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create link' },
      { status: 500 }
    );
  }
}
