/**
 * Brand Builder — Identity API (Phase 91)
 *
 * POST /api/brand/identity — Save/update brand identity, generate entity graph + consistency report
 * GET  /api/brand/identity — List user's brand identities
 *
 * @module app/api/brand/identity/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { buildEntityGraph } from '@/lib/brand/entity-graph-builder';
import { scoreConsistency } from '@/lib/brand/consistency-scorer';
import { logger } from '@/lib/logger';

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-identity:${ip}`;
  },
});

// ─── Validation ────────────────────────────────────────────────────────────────

const AddressSchema = z.object({
  street:   z.string().optional(),
  suburb:   z.string().optional(),
  state:    z.string().optional(),
  postcode: z.string().optional(),
  country:  z.string().optional(),
}).optional();

const DeclaredHandleSchema = z.object({
  platform: z.string(),
  url:      z.string(),
  handle:   z.string().optional(),
});

const PostSchema = z.object({
  entityType:          z.enum(['organization', 'person', 'local-business']),
  canonicalName:       z.string().min(1).max(200),
  canonicalUrl:        z.string().url(),
  description:         z.string().max(2000).optional(),
  logoUrl:             z.string().url().optional(),
  foundingDate:        z.string().optional(),
  hasPhysicalLocation: z.boolean().optional(),
  address:             AddressSchema,
  phone:               z.string().optional(),
  wikidataUrl:         z.string().url().optional(),
  wikipediaUrl:        z.string().url().optional(),
  linkedinUrl:         z.string().url().optional(),
  crunchbaseUrl:       z.string().url().optional(),
  youtubeUrl:          z.string().url().optional(),
  twitterUrl:          z.string().url().optional(),
  facebookUrl:         z.string().url().optional(),
  instagramUrl:        z.string().url().optional(),
  declaredHandles:     z.array(DeclaredHandleSchema).optional(),
});

// ─── POST — save brand identity ────────────────────────────────────────────────

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

    const input = parsed.data;

    // 4. Generate entity graph and consistency report
    const entityGraph     = buildEntityGraph(input);
    const consistencyData = scoreConsistency(input);

    // 5. Upsert BrandIdentity (unique on canonicalUrl + userId)
    const identity = await prisma.brandIdentity.upsert({
      where: {
        // Using a compound unique would require @@unique — we use findFirst + update/create pattern
        id: 'placeholder-never-matches',
      },
      update: {},
      create: {
        userId,
        orgId:              userId,
        entityType:         input.entityType,
        canonicalName:      input.canonicalName,
        canonicalUrl:       input.canonicalUrl,
        description:        input.description ?? null,
        logoUrl:            input.logoUrl ?? null,
        foundingDate:       input.foundingDate ?? null,
        hasPhysicalLocation: input.hasPhysicalLocation ?? false,
        address:            input.address ? (input.address as Prisma.InputJsonValue) : undefined,
        phone:              input.phone ?? null,
        wikidataUrl:        input.wikidataUrl ?? null,
        wikipediaUrl:       input.wikipediaUrl ?? null,
        linkedinUrl:        input.linkedinUrl ?? null,
        crunchbaseUrl:      input.crunchbaseUrl ?? null,
        youtubeUrl:         input.youtubeUrl ?? null,
        twitterUrl:         input.twitterUrl ?? null,
        facebookUrl:        input.facebookUrl ?? null,
        instagramUrl:       input.instagramUrl ?? null,
        entityGraph:        entityGraph as unknown as Prisma.InputJsonValue,
        consistencyScore:   consistencyData.overallScore,
        consistencyReport:  consistencyData as unknown as Prisma.InputJsonValue,
      },
    }).catch(async () => {
      // Upsert fallback: find existing and update, or create new
      const existing = await prisma.brandIdentity.findFirst({
        where: { userId, canonicalUrl: input.canonicalUrl },
      });

      if (existing) {
        return prisma.brandIdentity.update({
          where: { id: existing.id },
          data: {
            entityType:         input.entityType,
            canonicalName:      input.canonicalName,
            description:        input.description ?? null,
            logoUrl:            input.logoUrl ?? null,
            foundingDate:       input.foundingDate ?? null,
            hasPhysicalLocation: input.hasPhysicalLocation ?? false,
            address:            input.address ? (input.address as Prisma.InputJsonValue) : undefined,
            phone:              input.phone ?? null,
            wikidataUrl:        input.wikidataUrl ?? null,
            wikipediaUrl:       input.wikipediaUrl ?? null,
            linkedinUrl:        input.linkedinUrl ?? null,
            crunchbaseUrl:      input.crunchbaseUrl ?? null,
            youtubeUrl:         input.youtubeUrl ?? null,
            twitterUrl:         input.twitterUrl ?? null,
            facebookUrl:        input.facebookUrl ?? null,
            instagramUrl:       input.instagramUrl ?? null,
            entityGraph:        entityGraph as unknown as Prisma.InputJsonValue,
            consistencyScore:   consistencyData.overallScore,
            consistencyReport:  consistencyData as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return prisma.brandIdentity.create({
        data: {
          userId,
          orgId:              userId,
          entityType:         input.entityType,
          canonicalName:      input.canonicalName,
          canonicalUrl:       input.canonicalUrl,
          description:        input.description ?? null,
          logoUrl:            input.logoUrl ?? null,
          foundingDate:       input.foundingDate ?? null,
          hasPhysicalLocation: input.hasPhysicalLocation ?? false,
          address:            input.address ? (input.address as Prisma.InputJsonValue) : undefined,
          phone:              input.phone ?? null,
          wikidataUrl:        input.wikidataUrl ?? null,
          wikipediaUrl:       input.wikipediaUrl ?? null,
          linkedinUrl:        input.linkedinUrl ?? null,
          crunchbaseUrl:      input.crunchbaseUrl ?? null,
          youtubeUrl:         input.youtubeUrl ?? null,
          twitterUrl:         input.twitterUrl ?? null,
          facebookUrl:        input.facebookUrl ?? null,
          instagramUrl:       input.instagramUrl ?? null,
          entityGraph:        entityGraph as unknown as Prisma.InputJsonValue,
          consistencyScore:   consistencyData.overallScore,
          consistencyReport:  consistencyData as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return NextResponse.json({ identity, entityGraph });
  } catch (error) {
    logger.error('Brand identity POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to save brand identity' }, { status: 500 });
  }
}

// ─── GET — list brand identities ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised', message: 'Authentication required' }, { status: 401 });
    }

    // 2. Fetch identities (omit entityGraph from list for performance)
    const identities = await prisma.brandIdentity.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id:                  true,
        entityType:          true,
        canonicalName:       true,
        canonicalUrl:        true,
        description:         true,
        logoUrl:             true,
        foundingDate:        true,
        hasPhysicalLocation: true,
        address:             true,
        phone:               true,
        wikidataUrl:         true,
        wikipediaUrl:        true,
        linkedinUrl:         true,
        crunchbaseUrl:       true,
        youtubeUrl:          true,
        twitterUrl:          true,
        facebookUrl:         true,
        instagramUrl:        true,
        wikidataQId:         true,
        kgmid:               true,
        kgConfidence:        true,
        consistencyScore:    true,
        consistencyReport:   true,
        createdAt:           true,
        updatedAt:           true,
      },
    });

    return NextResponse.json({ identities });
  } catch (error) {
    logger.error('Brand identity GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch brand identities' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
