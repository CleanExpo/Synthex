/**
 * Prompt Gap Analysis API (Phase 96)
 *
 * GET /api/prompts/gaps — Gap analysis for the user's tested prompt trackers
 *
 * Fetches all tested trackers + their results, runs the gap analyser,
 * and returns PromptGapAnalysis + CompetitorVisibility[].
 *
 * @module app/api/prompts/gaps/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyzeGaps, aggregateCompetitors } from '@/lib/prompts/gap-analyzer';

// ─── GET /api/prompts/gaps ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId      = searchParams.get('orgId');
    const entityName = searchParams.get('entityName');  // filter by entity if multiple

    const where: Record<string, unknown> = { userId };
    if (orgId)      where.orgId      = orgId;
    if (entityName) where.entityName = entityName;

    // Fetch all tested trackers for this user
    const trackers = await prisma.promptTracker.findMany({
      where: { ...where, status: 'tested' },
      include: {
        results: {
          orderBy: { testedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (trackers.length === 0) {
      return NextResponse.json({
        gapAnalysis: null,
        competitors: [],
        message: 'No tested prompts found. Test some prompts first.',
      });
    }

    // Flatten results for the analyzer
    const allResults = trackers.flatMap((t) => t.results);

    const gapAnalysis  = analyzeGaps(trackers, allResults);
    const competitors  = aggregateCompetitors(allResults, trackers.length);

    return NextResponse.json({
      gapAnalysis,
      competitors,
      trackerCount: trackers.length,
    });
  } catch (err) {
    console.error('[GET /api/prompts/gaps]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
