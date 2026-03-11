/**
 * Brand Builder — Knowledge Graph Check API (Phase 91)
 *
 * GET /api/brand/kg-check?brandId=XXX
 *
 * @module app/api/brand/kg-check/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { checkKnowledgeGraph } from '@/lib/brand/kg-confidence-checker';
import { logger } from '@/lib/logger';

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-kg-check:${ip}`;
  },
});

// ─── GET — check Knowledge Graph ──────────────────────────────────────────────

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

    // 4. Verify ownership
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
      select: { id: true, canonicalName: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 });
    }

    // 5. Check if API key is configured
    const apiKey = process.env.GOOGLE_KG_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        found:      false,
        reason:     'API key not configured',
        kgmid:      null,
        name:       null,
        description: null,
        confidence: 0,
        types:      [],
        checkedAt:  new Date().toISOString(),
      });
    }

    // 6. Check Knowledge Graph
    const result = await checkKnowledgeGraph(brand.canonicalName, apiKey);

    // 7. Update KGMID and confidence if found
    if (result.kgmid) {
      await prisma.brandIdentity.update({
        where: { id: brandId },
        data: {
          kgmid:       result.kgmid,
          kgConfidence: result.confidence,
          updatedAt:   new Date(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Brand KG check GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to check Knowledge Graph' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
