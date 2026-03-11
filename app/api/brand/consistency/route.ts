/**
 * Brand Builder — Consistency Audit API (Phase 91)
 *
 * POST /api/brand/consistency — Run NAP consistency audit for a saved brand identity
 *
 * @module app/api/brand/consistency/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { scoreConsistency } from '@/lib/brand/consistency-scorer';
import type { BrandIdentityInput } from '@/lib/brand/types';
import { logger } from '@/lib/logger';

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-consistency:${ip}`;
  },
});

// ─── Validation ────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  brandId: z.string().min(1),
});

// ─── POST — run consistency audit ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    // 3. Validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { brandId } = parsed.data;

    // 4. Fetch brand identity and verify ownership
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found', message: 'No brand identity found with the given ID for this user' }, { status: 404 });
    }

    // 5. Reconstruct BrandIdentityInput from DB record
    const input: BrandIdentityInput = {
      entityType:          brand.entityType as BrandIdentityInput['entityType'],
      canonicalName:       brand.canonicalName,
      canonicalUrl:        brand.canonicalUrl,
      description:         brand.description ?? undefined,
      logoUrl:             brand.logoUrl ?? undefined,
      foundingDate:        brand.foundingDate ?? undefined,
      hasPhysicalLocation: brand.hasPhysicalLocation,
      address:             brand.address as BrandIdentityInput['address'],
      phone:               brand.phone ?? undefined,
      wikidataUrl:         brand.wikidataUrl ?? undefined,
      wikipediaUrl:        brand.wikipediaUrl ?? undefined,
      linkedinUrl:         brand.linkedinUrl ?? undefined,
      crunchbaseUrl:       brand.crunchbaseUrl ?? undefined,
      youtubeUrl:          brand.youtubeUrl ?? undefined,
      twitterUrl:          brand.twitterUrl ?? undefined,
      facebookUrl:         brand.facebookUrl ?? undefined,
      instagramUrl:        brand.instagramUrl ?? undefined,
    };

    // 6. Score consistency
    const report = scoreConsistency(input);

    // 7. Persist updated scores
    await prisma.brandIdentity.update({
      where: { id: brandId },
      data: {
        consistencyScore:  report.overallScore,
        consistencyReport: report as unknown as Prisma.InputJsonValue,
        updatedAt:         new Date(),
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    logger.error('Brand consistency POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to run consistency audit' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
