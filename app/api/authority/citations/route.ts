/**
 * Authority Citations API — Retrieve Citations for an Analysis
 *
 * GET /api/authority/citations?analysisId=<id>
 * Returns: AuthorityCitation[]
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authority/citations/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const analysisId = searchParams.get('analysisId');

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId query parameter is required' }, { status: 400 });
    }

    // Verify the analysis belongs to the requesting user
    const analysis = await prisma.authorityAnalysis.findUnique({
      where: { id: analysisId },
      select: { userId: true },
    });

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    if (analysis.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const citations = await prisma.authorityCitation.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        analysisId: true,
        claimText: true,
        sourceUrl: true,
        sourceType: true,
        sourceName: true,
        confidence: true,
        citationText: true,
        verified: true,
        createdAt: true,
      },
    });

    return NextResponse.json(citations);
  } catch (error) {
    logger.error('Authority citations fetch error', error);
    return NextResponse.json({ error: 'Failed to fetch citations' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
