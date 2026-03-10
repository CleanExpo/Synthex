/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: combined E-E-A-T + GEO audit pipeline; intended for content and SEO audit workflows.
 * Wire when an EEAT audit panel is added to the content or SEO dashboard pages.
 */

/**
 * E-E-A-T Full Audit API — Combined E-E-A-T + GEO audit
 *
 * POST /api/eeat/audit
 * Body: { content: string, url?: string, authorInfo?: {...}, contentType?: string }
 * Returns: { eeat: EEATAnalysisResult, geo: GEOAnalysisResult, combined: { overall, tier } }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * FAILURE MODE: Service will not start if missing
 *
 * @module app/api/eeat/audit/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { scoreEEAT } from '@/lib/eeat/eeat-scorer';
import { analyzeGEO } from '@/lib/geo/geo-analyzer';
import type { ContentType } from '@/lib/eeat/types';
import { logger } from '@/lib/logger';

const auditSchema = z.object({
  content: z.string().min(100, 'Content must be at least 100 characters'),
  url: z.string().url().optional(),
  authorInfo: z.object({
    name: z.string(),
    credentials: z.array(z.object({
      type: z.string(),
      title: z.string(),
      institution: z.string().optional(),
      year: z.number().optional(),
    })).optional(),
    socialLinks: z.record(z.string()).optional(),
    bio: z.string().optional(),
  }).optional(),
  contentType: z.enum(['article', 'product', 'service', 'ymyl', 'general']).optional().default('general'),
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
    const validation = auditSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { content, url, authorInfo, contentType } = validation.data;

    // Run both analyses in parallel
    const [eeatResult, geoResult] = await Promise.all([
      scoreEEAT({ content, authorInfo, url, contentType: contentType as ContentType }),
      analyzeGEO({ contentText: content, contentUrl: url }),
    ]);

    // Combined score (50% E-E-A-T, 50% GEO)
    const combinedScore = Math.round(eeatResult.score.overall * 0.5 + geoResult.score.overall * 0.5);
    const combinedTier = combinedScore >= 80 ? 'excellent'
      : combinedScore >= 60 ? 'good'
      : combinedScore >= 40 ? 'needs_work'
      : 'poor';

    // Store as full audit
    await prisma.sEOAudit.create({
      data: {
        userId,
        url: url || 'inline-content',
        auditType: 'full',
        overallScore: combinedScore,
        eeatScore: eeatResult.score as any,
        geoScore: geoResult.score as any,
        recommendations: [
          ...eeatResult.recommendations.map(r => ({ source: 'eeat', ...r })),
          ...geoResult.recommendations.map(r => ({ source: 'geo', ...r })),
        ] as any,
        rawData: {
          eeat: {
            experienceSignals: eeatResult.experienceSignals,
            expertiseSignals: eeatResult.expertiseSignals,
            authoritySignals: eeatResult.authoritySignals,
            trustSignals: eeatResult.trustSignals,
            aiDetection: eeatResult.aiDetection,
            tier: eeatResult.tier,
          },
          geo: {
            structureAnalysis: geoResult.structureAnalysis,
            platformScores: geoResult.platformScores,
            schemaIssues: geoResult.schemaIssues,
            metadata: geoResult.metadata,
          },
        } as any,
      },
    });

    return NextResponse.json({
      eeat: eeatResult,
      geo: geoResult,
      combined: {
        overall: combinedScore,
        tier: combinedTier,
      },
    });
  } catch (error) {
    logger.error('Full audit error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to run audit' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
