/**
 * Revenue Projector — SYN-485
 *
 * Projects monthly revenue uplift if tracked keywords reach top-3 positions,
 * using industry CTR curves and the org's actual revenue-per-click baseline.
 */

import { prisma } from '@/lib/prisma';

const INDUSTRY_DEFAULT_RPC = 2.5; // $2.50 per click fallback

// CTR curve: position → expected click-through rate (0–1)
function positionToCTR(position: number | null): number {
  if (!position) return 0.005;
  if (position <= 1) return 0.285;
  if (position <= 2) return 0.157;
  if (position <= 3) return 0.11;
  if (position <= 4) return 0.08;
  if (position <= 5) return 0.072;
  if (position <= 10) return 0.04;
  if (position <= 20) return 0.015;
  return 0.005;
}

export interface KeywordProjection {
  keyword: string;
  currentPosition: number | null;
  targetPosition: number; // always 3
  currentMonthlyClicks: number;
  projectedMonthlyClicks: number;
  additionalClicks: number;
  projectedUplift: number; // $
}

export interface RevenueProjection {
  currentMonthlyRevenue: number;
  projectedMonthlyRevenue: number;
  upliftAmount: number;
  upliftPercent: number;
  revenuePerClick: number;
  keywordBreakdown: KeywordProjection[];
  hasGSC: boolean;
  hasKeywordTargets: boolean;
}

export async function projectRankingRevenue(
  orgId: string
): Promise<RevenueProjection> {
  // Check GSC connectivity
  const gscProperty = await prisma.gSCProperty.findFirst({
    where: { organizationId: orgId, isPrimary: true },
  });

  if (!gscProperty) {
    return {
      currentMonthlyRevenue: 0,
      projectedMonthlyRevenue: 0,
      upliftAmount: 0,
      upliftPercent: 0,
      revenuePerClick: INDUSTRY_DEFAULT_RPC,
      keywordBreakdown: [],
      hasGSC: false,
      hasKeywordTargets: false,
    };
  }

  // Get keyword targets with latest snapshots
  const targets = await prisma.keywordTarget.findMany({
    where: { organizationId: orgId, isActive: true },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
      },
    },
  });

  if (targets.length === 0) {
    return {
      currentMonthlyRevenue: 0,
      projectedMonthlyRevenue: 0,
      upliftAmount: 0,
      upliftPercent: 0,
      revenuePerClick: INDUSTRY_DEFAULT_RPC,
      keywordBreakdown: [],
      hasGSC: true,
      hasKeywordTargets: false,
    };
  }

  // Calculate revenue-per-click baseline from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  // Get total GSC clicks for the org (sum from KeywordRankSnapshot)
  const clicksResult = await prisma.keywordRankSnapshot.aggregate({
    where: {
      organizationId: orgId,
      snapshotDate: { gte: ninetyDaysAgo },
    },
    _sum: { clicks: true },
  });
  const totalGSCClicks = clicksResult._sum.clicks ?? 0;

  // Get total revenue for the org (last 90 days)
  // RevenueEntry uses userId not organizationId — find owner user first
  const ownerUser = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  let totalRevenue = 0;
  if (ownerUser) {
    const revenueResult = await prisma.revenueEntry.aggregate({
      where: {
        userId: ownerUser.id,
        paidAt: { gte: ninetyDaysAgo },
      },
      _sum: { amount: true },
    });
    totalRevenue = Number(revenueResult._sum.amount ?? 0);
  }

  // Revenue per click: if we have both metrics, calculate; else use industry default
  const revenuePerClick =
    totalGSCClicks > 0 && totalRevenue > 0
      ? totalRevenue / totalGSCClicks
      : INDUSTRY_DEFAULT_RPC;

  // Monthly revenue baseline (90-day total ÷ 3)
  const currentMonthlyRevenue = totalRevenue / 3;

  // Project uplift per keyword
  const TARGET_POSITION = 3;
  let totalAdditionalClicks = 0;
  const keywordBreakdown: KeywordProjection[] = [];

  for (const target of targets) {
    const latestSnap = target.snapshots[0];
    const currentPosition = latestSnap?.position ?? null;
    const monthlyImpressions = ((latestSnap?.impressions ?? 0) / 7) * 30; // weekly → monthly

    const currentCTR = positionToCTR(currentPosition);
    const targetCTR = positionToCTR(TARGET_POSITION);

    const currentMonthlyClicks = monthlyImpressions * currentCTR;
    const projectedMonthlyClicks = monthlyImpressions * targetCTR;
    const additionalClicks = Math.max(
      0,
      projectedMonthlyClicks - currentMonthlyClicks
    );
    const projectedUplift = additionalClicks * revenuePerClick;

    totalAdditionalClicks += additionalClicks;

    keywordBreakdown.push({
      keyword: target.keyword,
      currentPosition,
      targetPosition: TARGET_POSITION,
      currentMonthlyClicks: Math.round(currentMonthlyClicks),
      projectedMonthlyClicks: Math.round(projectedMonthlyClicks),
      additionalClicks: Math.round(additionalClicks),
      projectedUplift,
    });
  }

  // Sort by uplift potential (highest first)
  keywordBreakdown.sort((a, b) => b.projectedUplift - a.projectedUplift);

  const upliftAmount = totalAdditionalClicks * revenuePerClick;
  const projectedMonthlyRevenue = currentMonthlyRevenue + upliftAmount;
  const upliftPercent =
    currentMonthlyRevenue > 0
      ? (upliftAmount / currentMonthlyRevenue) * 100
      : 0;

  return {
    currentMonthlyRevenue,
    projectedMonthlyRevenue,
    upliftAmount,
    upliftPercent,
    revenuePerClick,
    keywordBreakdown,
    hasGSC: true,
    hasKeywordTargets: true,
  };
}
