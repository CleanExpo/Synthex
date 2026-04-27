/**
 * Rank Snapshot Cron — SYN-476
 *
 * Runs weekly (Sunday 7pm UTC = Monday 5am AEST).
 * For each org with active KeywordTarget records:
 *   1. Pull GSC search analytics
 *   2. Store KeywordRankSnapshot for each target
 *
 * Runs before gsc-topic-sync (which uses rank data for opportunity scoring).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  takeRankSnapshot,
  upsertRankOpportunities,
} from '@/lib/seo/rank-tracker';
import { calculateVisibilityScore } from '@/lib/scoring/visibility-score';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'RANK_SNAPSHOT');
  if (!auth.ok) return auth.response;

  let processed = 0;
  let totalSnapshots = 0;
  let errors = 0;

  try {
    // Find all orgs that have active keyword targets
    const orgs = await prisma.keywordTarget.groupBy({
      by: ['organizationId'],
      where: { isActive: true },
    });

    for (const { organizationId } of orgs) {
      try {
        const snapshotCount = await takeRankSnapshot(organizationId);
        totalSnapshots += snapshotCount;
        processed++;
        // Wire rank snapshots into ContentTopicSuggestion (positions 6–20, ≥50 impressions)
        upsertRankOpportunities(organizationId).catch(() => {});
        // Recalculate visibility score after rank update
        calculateVisibilityScore(organizationId).catch(() => {});
      } catch (err) {
        errors++;
        logger.error('rank-snapshot:org-failed', {
          organizationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('rank-snapshot:complete', {
      processed,
      totalSnapshots,
      errors,
    });

    return NextResponse.json({
      success: true,
      processed,
      totalSnapshots,
      errors,
    });
  } catch (error) {
    logger.error('rank-snapshot:fatal', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Rank snapshot cron failed' },
      { status: 500 }
    );
  }
}
