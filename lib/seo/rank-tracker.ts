/**
 * Keyword Rank Tracker — SYN-476
 *
 * Manages KeywordTarget records and weekly GSC rank snapshots.
 * Data source: GSC search analytics (query dimension, 7-day window).
 *
 * Key operations:
 * - addKeywordTarget: register a keyword (max 20 per org)
 * - removeKeywordTarget: deactivate a target (org-scoped)
 * - takeRankSnapshot: pull GSC analytics and store KeywordRankSnapshot
 * - getRankMovement: latest vs N-days-prior position delta
 * - getRankScoreForVisibility: 0–20 score for VisibilityScore composite
 */

import prisma from '@/lib/prisma';
import { getSearchAnalytics } from '@/lib/google/search-console';
import { logger } from '@/lib/logger';

const MAX_KEYWORDS_PER_ORG = 20;

export interface RankMovement {
  keyword: string;
  location: string | null;
  currentPosition: number | null;
  previousPosition: number | null;
  change: number | null; // negative = improved (moved up), positive = dropped
  trend: 'up' | 'down' | 'stable' | 'new';
}

// ============================================================================
// MANAGE TARGETS
// ============================================================================

export async function addKeywordTarget(
  orgId: string,
  keyword: string,
  location?: string
): Promise<{ id: string; keyword: string; location: string | null }> {
  // Enforce max 20 per org
  const count = await prisma.keywordTarget.count({
    where: { organizationId: orgId, isActive: true },
  });
  if (count >= MAX_KEYWORDS_PER_ORG) {
    throw new Error(
      `Maximum of ${MAX_KEYWORDS_PER_ORG} keyword targets per organisation. Remove one before adding another.`
    );
  }

  const target = await prisma.keywordTarget.upsert({
    where: { organizationId_keyword: { organizationId: orgId, keyword } },
    update: { isActive: true, location: location ?? null },
    create: { organizationId: orgId, keyword, location: location ?? null },
  });

  return { id: target.id, keyword: target.keyword, location: target.location };
}

export async function removeKeywordTarget(
  orgId: string,
  targetId: string
): Promise<void> {
  const target = await prisma.keywordTarget.findFirst({
    where: { id: targetId, organizationId: orgId },
  });
  if (!target) {
    throw new Error('Keyword target not found');
  }

  await prisma.keywordTarget.update({
    where: { id: targetId },
    data: { isActive: false },
  });
}

// ============================================================================
// SNAPSHOT
// ============================================================================

/**
 * Pull GSC search analytics for all active keyword targets of an org,
 * then store a KeywordRankSnapshot for today.
 *
 * Uses the primary GSCProperty's siteUrl. No-op if no primary property exists.
 */
export async function takeRankSnapshot(orgId: string): Promise<number> {
  const property = await prisma.gSCProperty.findFirst({
    where: { organizationId: orgId, isPrimary: true },
    select: { siteUrl: true },
  });
  if (!property) return 0;

  const targets = await prisma.keywordTarget.findMany({
    where: { organizationId: orgId, isActive: true },
  });
  if (targets.length === 0) return 0;

  let analytics;
  try {
    analytics = await getSearchAnalytics(property.siteUrl, {
      dimensions: ['query'],
      rowLimit: 1000,
      startDate: getDateDaysAgo(7),
      endDate: getDateDaysAgo(0),
    });
  } catch (err) {
    logger.error('rank-tracker:gsc-fetch-failed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let snapshotCount = 0;

  for (const target of targets) {
    const row = analytics.rows.find(
      r => r.keys[0]?.toLowerCase() === target.keyword.toLowerCase()
    );

    try {
      await prisma.keywordRankSnapshot.upsert({
        where: {
          keywordTargetId_snapshotDate: {
            keywordTargetId: target.id,
            snapshotDate: today,
          },
        },
        update: {
          position: row?.position ?? null,
          impressions: row?.impressions ?? null,
          clicks: row?.clicks ?? null,
          ctr: row?.ctr ?? null,
        },
        create: {
          organizationId: orgId,
          keywordTargetId: target.id,
          position: row?.position ?? null,
          impressions: row?.impressions ?? null,
          clicks: row?.clicks ?? null,
          ctr: row?.ctr ?? null,
          snapshotDate: today,
        },
      });
      snapshotCount++;
    } catch (err) {
      logger.error('rank-tracker:snapshot-failed', {
        keywordTargetId: target.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('rank-tracker:snapshot-complete', { orgId, snapshotCount });
  return snapshotCount;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getRankMovement(
  orgId: string,
  days: 7 | 30
): Promise<RankMovement[]> {
  const targets = await prisma.keywordTarget.findMany({
    where: { organizationId: orgId, isActive: true },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 2,
      },
    },
  });

  const cutoff = new Date(Date.now() - days * 86400000);

  return targets.map(target => {
    const latest = target.snapshots[0] ?? null;
    const previous =
      target.snapshots.find(s => s.snapshotDate <= cutoff) ?? null;

    const currentPosition = latest?.position ?? null;
    const previousPosition = previous?.position ?? null;

    let change: number | null = null;
    let trend: RankMovement['trend'] = 'stable';

    if (currentPosition !== null && previousPosition !== null) {
      change = currentPosition - previousPosition;
      if (change < -0.5)
        trend = 'up'; // improved
      else if (change > 0.5) trend = 'down'; // dropped
    } else if (currentPosition !== null && previousPosition === null) {
      trend = 'new';
    }

    return {
      keyword: target.keyword,
      location: target.location,
      currentPosition,
      previousPosition,
      change,
      trend,
    };
  });
}

/**
 * 0–20 score component for VisibilityScore composite.
 *
 * Logic:
 * - No active targets → 0 (not penalised — no data yet)
 * - % of keywords in top 10 → scaled 0–20
 * - Bonus: average position ≤ 5 → +3 pts (capped at 20)
 */
export async function getRankScoreForVisibility(
  orgId: string
): Promise<number> {
  const targets = await prisma.keywordTarget.findMany({
    where: { organizationId: orgId, isActive: true },
  });
  if (targets.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() - 14 * 86400000);

  const snapshots = await prisma.keywordRankSnapshot.findMany({
    where: {
      organizationId: orgId,
      snapshotDate: { gte: cutoff },
      position: { not: null },
    },
    orderBy: { snapshotDate: 'desc' },
    distinct: ['keywordTargetId'],
  });

  if (snapshots.length === 0) return 0;

  const positions = snapshots.map(s => s.position as number);
  const inTop10 = positions.filter(p => p <= 10).length;
  const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;

  const baseScore = Math.round((inTop10 / targets.length) * 17);
  const bonus = avgPosition <= 5 ? 3 : 0;

  return Math.min(20, baseScore + bonus);
}

// ============================================================================
// CONTENT TOPIC OPPORTUNITIES
// ============================================================================

/**
 * Upsert ContentTopicSuggestion records for keywords that are in positions
 * 6–20 with ≥50 impressions in today's snapshot.
 *
 * Called after takeRankSnapshot succeeds (fire-and-forget).
 */
export async function upsertRankOpportunities(orgId: string): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get latest snapshots for active targets in positions 6–20 with ≥50 impressions
  const snapshots = await prisma.keywordRankSnapshot.findMany({
    where: {
      organizationId: orgId,
      snapshotDate: { gte: today },
      position: { gte: 6, lte: 20 },
      impressions: { gte: 50 },
    },
    include: { keywordTarget: true },
  });

  for (const snap of snapshots) {
    const opportunityScore =
      (snap.impressions ?? 0) * (20 - (snap.position ?? 20));
    await prisma.contentTopicSuggestion.upsert({
      where: {
        organizationId_keyword: {
          organizationId: orgId,
          keyword: snap.keywordTarget.keyword,
        },
      },
      update: {
        impressions: snap.impressions ?? 0,
        currentRank: snap.position ?? 0,
        opportunityScore,
        usedAt: null,
      },
      create: {
        organizationId: orgId,
        keyword: snap.keywordTarget.keyword,
        impressions: snap.impressions ?? 0,
        currentRank: snap.position ?? 0,
        opportunityScore,
      },
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getDateDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86400000);
  return date.toISOString().split('T')[0];
}
