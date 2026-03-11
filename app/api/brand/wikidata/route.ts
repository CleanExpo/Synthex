/**
 * Brand Builder — Wikidata Check API (Phase 91)
 *
 * GET /api/brand/wikidata?brandId=XXX
 *
 * @module app/api/brand/wikidata/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { checkWikidata } from '@/lib/brand/wikidata-checker';
import { logger } from '@/lib/logger';

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-wikidata:${ip}`;
  },
});

// ─── GET — check Wikidata ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised', message: 'Authentication required' }, { status: 401 });
    }

    // 2. Rate limit
    const rateResult = await rateLimiter.check(request);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again shortly.' }, { status: 429 });
    }

    // 3. Get brandId from query
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
    }

    // 4. Verify ownership and fetch brand
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
      select: { id: true, canonicalName: true, wikidataUrl: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 });
    }

    // 5. Check Wikidata
    const result = await checkWikidata(brand.canonicalName, brand.wikidataUrl ?? undefined);

    // 6. Update wikidataQId if found
    if (result.qId) {
      await prisma.brandIdentity.update({
        where: { id: brandId },
        data: {
          wikidataQId: result.qId,
          updatedAt:   new Date(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Brand wikidata GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to check Wikidata' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
