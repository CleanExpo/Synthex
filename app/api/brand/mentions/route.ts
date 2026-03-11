/**
 * Brand Builder — Mentions List API (Phase 91)
 *
 * GET /api/brand/mentions?brandId=XXX&page=1&limit=20
 *
 * @module app/api/brand/mentions/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// ─── GET — fetch brand mentions ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised', message: 'Authentication required' }, { status: 401 });
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
    }

    // 3. Verify brand ownership
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
      select: { id: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 });
    }

    // 4. Fetch mentions with pagination
    const [mentions, total] = await Promise.all([
      prisma.brandMention.findMany({
        where: { brandId },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip:  (page - 1) * limit,
        take:  limit,
        select: {
          id:          true,
          url:         true,
          title:       true,
          description: true,
          publishedAt: true,
          source:      true,
          apiSource:   true,
          sentiment:   true,
          createdAt:   true,
        },
      }),
      prisma.brandMention.count({ where: { brandId } }),
    ]);

    return NextResponse.json({ mentions, total, page, limit });
  } catch (error) {
    logger.error('Brand mentions GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch brand mentions' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
