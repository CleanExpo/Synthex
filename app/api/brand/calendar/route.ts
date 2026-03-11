/**
 * Brand Builder — Calendar API (Phase 91)
 *
 * POST /api/brand/calendar — Generate 90-day brand publishing + maintenance calendar
 *
 * @module app/api/brand/calendar/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { generateBrandCalendar } from '@/lib/brand/brand-calendar';
import type { BrandIdentityInput } from '@/lib/brand/types';
import { logger } from '@/lib/logger';

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-calendar:${ip}`;
  },
});

// ─── Validation ────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  brandId:      z.string().min(1),
  coverageDays: z.number().int().min(7).max(365).optional(),
});

// ─── POST — generate calendar ──────────────────────────────────────────────────

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

    const { brandId, coverageDays } = parsed.data;

    // 4. Verify ownership and fetch brand + credentials
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
      include: {
        credentials: {
          select: {
            type:      true,
            title:     true,
            expiresAt: true,
          },
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 });
    }

    // 5. Reconstruct BrandIdentityInput
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

    // 6. Build credentials for expiry-based events
    const credentials = brand.credentials.map(c => ({
      type:      c.type,
      title:     c.title,
      expiresAt: c.expiresAt?.toISOString(),
    }));

    // 7. Generate calendar
    const calendar = generateBrandCalendar(input, { credentials, coverageDays });

    return NextResponse.json(calendar);
  } catch (error) {
    logger.error('Brand calendar POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to generate brand calendar' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
