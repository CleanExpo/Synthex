/**
 * Competitor Displacement Service — SYN-484
 *
 * Finds keywords where tracked competitors outrank us,
 * scored by traffic potential (impressions × position gap).
 */

import prisma from '@/lib/prisma';
import { getSearchAnalytics } from '@/lib/google/search-console';

export interface DisplacementOpportunity {
  id: string;
  keyword: string;
  ourPosition: number | null;
  competitorName: string;
  competitorDomain: string;
  competitorPosition: number | null;
  gap: number | null; // ourPosition - competitorPosition (positive = they rank higher/better)
  impressions: number | null;
  displacementScore: number | null;
}

/**
 * Syncs keyword positions from GSC for our site against tracked competitors.
 * Competitor positions are entered manually via the dashboard (no API access).
 * This function stores our GSC positions for keywords that competitors track.
 */
export async function syncOurKeywordPositions(orgId: string): Promise<void> {
  // Get primary GSC property for this org
  const gscProperty = await prisma.gSCProperty.findFirst({
    where: { organizationId: orgId, isPrimary: true },
  });
  if (!gscProperty) return;

  // Get all tracked competitors for this org — competitors are user-scoped but
  // we look them up via the org's keyword gap table
  const existingGaps = await prisma.competitorKeywordGap.findMany({
    where: { organizationId: orgId },
    select: { competitorId: true },
    distinct: ['competitorId'],
  });
  if (existingGaps.length === 0) return;

  // Pull our GSC positions for the site (top 200 queries)
  const analytics = await getSearchAnalytics(gscProperty.siteUrl, {
    dimensions: ['query'],
    rowLimit: 200,
    startDate: '7daysAgo',
    endDate: 'today',
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // For each competitor in this org, update our position in the gap table
  for (const { competitorId } of existingGaps) {
    // Get the most recent keyword gaps for this competitor
    const latestGaps = await prisma.competitorKeywordGap.findMany({
      where: { competitorId, organizationId: orgId },
      orderBy: { snapshotDate: 'desc' },
      distinct: ['keyword'],
    });

    for (const gap of latestGaps) {
      const ourRow = analytics.rows?.find(
        r => r.keys[0]?.toLowerCase() === gap.keyword.toLowerCase()
      );
      const ourPosition = ourRow ? ourRow.position : null;
      const impressions = ourRow ? ourRow.impressions : gap.impressions;
      const displacementScore =
        ourPosition !== null && gap.competitorPosition !== null
          ? (impressions ?? 0) * Math.abs(gap.competitorPosition - ourPosition)
          : null;

      await prisma.competitorKeywordGap.create({
        data: {
          organizationId: orgId,
          competitorId,
          keyword: gap.keyword,
          ourPosition,
          competitorPosition: gap.competitorPosition,
          impressions,
          displacementScore,
          snapshotDate: today,
        },
      });
    }
  }
}

/**
 * Returns displacement opportunities: keywords where a competitor outranks us.
 * Sorted by displacementScore DESC (highest traffic impact first).
 */
export async function getDisplacementOpportunities(
  orgId: string,
  limit = 10
): Promise<DisplacementOpportunity[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const gaps = await prisma.competitorKeywordGap.findMany({
    where: {
      organizationId: orgId,
      snapshotDate: { gte: sevenDaysAgo },
    },
    orderBy: { displacementScore: 'desc' },
    take: limit,
    include: {
      competitor: { select: { id: true, name: true, domain: true } },
    },
  });

  return gaps
    .filter(
      g =>
        g.competitorPosition !== null &&
        g.ourPosition !== null &&
        g.competitorPosition < g.ourPosition
    )
    .map(g => ({
      id: g.id,
      keyword: g.keyword,
      ourPosition: g.ourPosition,
      competitorName: g.competitor.name,
      competitorDomain: g.competitor.domain ?? '',
      competitorPosition: g.competitorPosition,
      gap:
        g.competitorPosition !== null && g.ourPosition !== null
          ? g.ourPosition - g.competitorPosition
          : null,
      impressions: g.impressions,
      displacementScore: g.displacementScore,
    }));
}
