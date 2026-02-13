/**
 * Loyalty Tier API
 *
 * GET /api/loyalty - Current tier, points, progress to next tier
 *
 * Tier progression: Bronze → Silver → Gold → Platinum
 * - Bronze: 0 points (default)
 * - Silver: 500 points
 * - Gold: 2000 points
 * - Platinum: 5000 points
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
};

const TIER_BENEFITS = {
  bronze: { bonusAiCredits: 0, discountPercent: 0, prioritySupport: false },
  silver: { bonusAiCredits: 25, discountPercent: 5, prioritySupport: false },
  gold: { bonusAiCredits: 100, discountPercent: 10, prioritySupport: true },
  platinum: { bonusAiCredits: 500, discountPercent: 15, prioritySupport: true },
};

function getTierForPoints(points: number): string {
  if (points >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (points >= TIER_THRESHOLDS.gold) return 'gold';
  if (points >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

function getNextTierInfo(currentTier: string, currentPoints: number) {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex >= tiers.length - 1) {
    return { nextTier: null, pointsNeeded: 0, progress: 100 };
  }
  const nextTier = tiers[currentIndex + 1] as keyof typeof TIER_THRESHOLDS;
  const pointsNeeded = TIER_THRESHOLDS[nextTier] - currentPoints;
  const currentThreshold = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS];
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const progress = Math.round(
    ((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  );
  return { nextTier, pointsNeeded: Math.max(0, pointsNeeded), progress: Math.min(100, Math.max(0, progress)) };
}

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse({ error: 'User ID not found' }, 401);
    }

    // Get or create loyalty tier
    let loyalty = await prisma.userLoyaltyTier.findUnique({
      where: { userId },
    });

    if (!loyalty) {
      // Auto-create on first access
      loyalty = await prisma.userLoyaltyTier.create({
        data: { userId },
      });
    }

    // Check if tier should be updated based on lifetime points
    const correctTier = getTierForPoints(loyalty.lifetimePoints);
    if (correctTier !== loyalty.tier) {
      const benefits = TIER_BENEFITS[correctTier as keyof typeof TIER_BENEFITS];
      loyalty = await prisma.userLoyaltyTier.update({
        where: { userId },
        data: {
          tier: correctTier,
          bonusAiCredits: benefits.bonusAiCredits,
          discountPercent: benefits.discountPercent,
          prioritySupport: benefits.prioritySupport,
          lastTierChange: new Date(),
        },
      });
    }

    const nextTierInfo = getNextTierInfo(loyalty.tier, loyalty.lifetimePoints);

    return APISecurityChecker.createSecureResponse({
      success: true,
      loyalty: {
        tier: loyalty.tier,
        points: loyalty.points,
        lifetimePoints: loyalty.lifetimePoints,
        monthsActive: loyalty.monthsActive,
        benefits: TIER_BENEFITS[loyalty.tier as keyof typeof TIER_BENEFITS],
        nextTier: nextTierInfo.nextTier,
        pointsToNextTier: nextTierInfo.pointsNeeded,
        progressToNextTier: nextTierInfo.progress,
      },
      allTiers: Object.entries(TIER_THRESHOLDS).map(([tier, threshold]) => ({
        tier,
        threshold,
        benefits: TIER_BENEFITS[tier as keyof typeof TIER_BENEFITS],
        isCurrent: tier === loyalty!.tier,
      })),
    });
  } catch (error) {
    console.error('Loyalty GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch loyalty data' },
      500
    );
  }
}
