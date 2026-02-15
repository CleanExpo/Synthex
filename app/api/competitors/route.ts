/**
 * Competitors API
 * GET /api/competitors - List competitive analyses
 * POST /api/competitors - Create a new competitive analysis
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Validation schemas
const createCompetitorSchema = z.object({
  generationId: z.string().uuid(),
  competitorName: z.string().min(1).max(200),
  competitorTagline: z.string().max(500).optional(),
  identifiedPrinciples: z.array(z.string()).optional().default([]),
  differentiationStrategy: z.string().max(2000).optional(),
  marketPosition: z.string().max(1000).optional()
});

const querySchema = z.object({
  generationId: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional()
});

/**
 * GET /api/competitors
 * Returns competitive analyses for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      generationId: url.searchParams.get('generationId') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined
    };

    const query = querySchema.parse(queryParams);
    const limit = query.limit ? parseInt(query.limit) : 20;
    const offset = query.offset ? parseInt(query.offset) : 0;

    // Build where clause - filter by user's brand generations
    const whereClause: {
      generation: { userId: string };
      generationId?: string;
    } = {
      generation: {
        userId: security.context.userId!  // Validated by security check above
      }
    };

    if (query.generationId) {
      whereClause.generationId = query.generationId;
    }

    // Fetch competitive analyses
    const [analyses, total] = await Promise.all([
      prisma.competitiveAnalysis.findMany({
        where: whereClause,
        orderBy: { analyzedAt: 'desc' },
        take: Math.min(limit, 50),
        skip: offset,
        include: {
          generation: {
            select: {
              id: true,
              brandNames: true,
              businessType: true
            }
          }
        }
      }),
      prisma.competitiveAnalysis.count({ where: whereClause })
    ]);

    return APISecurityChecker.createSecureResponse(
      {
        data: analyses,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + analyses.length < total
        }
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Competitors fetch error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid query parameters', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch competitive analyses' },
      500,
      security.context
    );
  }
}

/**
 * POST /api/competitors
 * Creates a new competitive analysis
 */
export async function POST(request: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const data = createCompetitorSchema.parse(body);

    // Verify user owns the brand generation
    const generation = await prisma.brandGeneration.findFirst({
      where: {
        id: data.generationId,
        userId: security.context.userId
      }
    });

    if (!generation) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Brand generation not found or not authorized' },
        404,
        security.context
      );
    }

    // Create competitive analysis
    const analysis = await prisma.competitiveAnalysis.create({
      data: {
        generationId: data.generationId,
        competitorName: data.competitorName,
        competitorTagline: data.competitorTagline || null,
        identifiedPrinciples: data.identifiedPrinciples,
        differentiationStrategy: data.differentiationStrategy || null,
        marketPosition: data.marketPosition || null
      },
      include: {
        generation: {
          select: {
            id: true,
            brandNames: true
          }
        }
      }
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        data: analysis
      },
      201,
      security.context
    );

  } catch (error) {
    console.error('Competitor creation error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid competitor data', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create competitive analysis' },
      500,
      security.context
    );
  }
}

export const runtime = 'nodejs';
