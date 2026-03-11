/**
 * GEO Analysis API — Analyze Content for AI Search Citability
 *
 * POST /api/geo/analyze
 * Body: { contentText: string, contentUrl?: string, contentId?: string, authorId?: number, platform?: string }
 * Returns: Full GEOAnalysisResult with scores, passages, recommendations
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * FAILURE MODE: Service will not start if missing
 *
 * @module app/api/geo/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyzeGEO } from '@/lib/geo/geo-analyzer';
import type { GEOPlatform } from '@/lib/geo/types';
import { logger } from '@/lib/logger';
import { registerObservationSilently } from '@/lib/bayesian/fallback';

const analyzeSchema = z.object({
  contentText: z.string().min(50, 'Content must be at least 50 characters'),
  contentUrl: z.string().url().optional(),
  contentId: z.string().optional(),
  authorId: z.number().int().optional(),
  platform: z.enum(['google_aio', 'chatgpt', 'perplexity', 'bing_copilot', 'all']).optional().default('all'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = analyzeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { contentText, contentUrl, contentId, authorId, platform } = validation.data;

    // Resolve the user's organisation — used for BO weight lookup and observation
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const orgId = userRecord?.organizationId ?? undefined;

    // Run GEO analysis with org context (enables BO-optimised weights)
    const result = await analyzeGEO({
      contentText,
      contentUrl,
      contentId,
      authorId,
      platform: platform as GEOPlatform,
      userId,
      orgId,
    }, orgId);

    // Store analysis in database
    const analysis = await prisma.gEOAnalysis.create({
      data: {
        userId,
        contentId: contentId || null,
        authorId: authorId || null,
        contentUrl: contentUrl || null,
        contentText,
        platform: platform || 'all',
        overallScore: result.score.overall,
        citabilityScore: result.score.citability,
        structureScore: result.score.structure,
        multiModalScore: result.score.multiModal,
        authorityScore: result.score.authority,
        technicalScore: result.score.technical,
        entityCoherenceScore: result.score.entityCoherence,
        citablePassages: result.citablePassages as unknown as Prisma.InputJsonValue,
        recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
        schemaIssues: result.schemaIssues as unknown as Prisma.InputJsonValue,
      },
    });

    // Persist entity analysis
    await prisma.entityAnalysis.create({
      data: {
        geoAnalysisId: analysis.id,
        userId,
        entityCount: result.entityAnalysis.entityCount,
        uniqueEntityCount: result.entityAnalysis.uniqueEntityCount,
        properNounDensity: result.entityAnalysis.properNounDensity,
        coherenceScore: result.entityAnalysis.score,
        entities: result.entityAnalysis.entities as unknown as Prisma.InputJsonValue,
        coherenceIssues: result.entityAnalysis.coherenceIssues as unknown as Prisma.InputJsonValue,
      },
    });

    // Fire-and-forget: register BO observation for geo_score_weights surface.
    // Uses void so the response is never blocked by BO service latency.
    if (orgId) {
      void registerObservationSilently(
        'geo_score_weights',
        orgId,
        {
          citability: result.score.citability / 100,
          structure:  result.score.structure  / 100,
          multiModal: result.score.multiModal / 100,
          authority:  result.score.authority  / 100,
          technical:  result.score.technical  / 100,
        },
        result.score.overall,
        { contentLength: contentText.length, platform },
      );
    }

    return NextResponse.json({
      id: analysis.id,
      ...result,
    });
  } catch (error) {
    logger.error('GEO analysis error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to analyze content' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
