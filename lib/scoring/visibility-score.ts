/**
 * Visibility Score — SYN-473
 *
 * Composite 0–100 score measuring how visible an org is on Google:
 *   Reviews    (0–40):  volume + rating quality of GBP reviews
 *   GBP        (0–20):  completeness of the Google Business Profile
 *   Content    (0–20):  published content volume in last 30 days
 *   Rankings   (0–20):  keyword rank movement (from SYN-476 rank-tracker)
 *
 * Recalculate triggers (call calculateVisibilityScore after each):
 *   - New review synced via gbp-monitor
 *   - Content published
 *   - Weekly rank snapshot taken
 *   - GBP profile updated
 */

import prisma from '@/lib/prisma';
import { getRankScoreForVisibility } from '@/lib/seo/rank-tracker';
import { logger } from '@/lib/logger';

export interface VisibilityScoreResult {
  id: string;
  organizationId: string;
  score: number;
  reviewScore: number;
  gbpScore: number;
  contentScore: number;
  rankScore: number;
  calculatedAt: Date;
}

// ============================================================================
// CALCULATE
// ============================================================================

export async function calculateVisibilityScore(
  orgId: string
): Promise<VisibilityScoreResult> {
  const [reviewScore, gbpScore, contentScore, rankScore] = await Promise.all([
    calcReviewScore(orgId),
    calcGbpScore(orgId),
    calcContentScore(orgId),
    getRankScoreForVisibility(orgId).catch(() => 0),
  ]);

  const totalScore = reviewScore + gbpScore + contentScore + rankScore;

  const result = await prisma.visibilityScore.create({
    data: {
      organizationId: orgId,
      score: totalScore,
      reviewScore,
      gbpScore,
      contentScore,
      rankScore,
    },
  });

  logger.info('visibility-score:calculated', {
    orgId,
    score: totalScore,
    reviewScore,
    gbpScore,
    contentScore,
    rankScore,
  });

  // Re-engagement trigger: if score dropped ≥5 pts vs last week, flag it
  triggerReengagementIfNeeded(orgId, totalScore).catch(() => {});

  return result as VisibilityScoreResult;
}

// ============================================================================
// COMPONENT CALCULATORS
// ============================================================================

async function calcReviewScore(orgId: string): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const [recentReviews, allReviews] = await Promise.all([
    prisma.gBPReview.count({
      where: { organizationId: orgId, reviewTime: { gte: ninetyDaysAgo } },
    }),
    prisma.gBPReview.findMany({
      where: { organizationId: orgId },
      select: { rating: true },
    }),
  ]);

  let base: number;
  if (recentReviews >= 10) base = 40;
  else if (recentReviews >= 5) base = 25;
  else if (recentReviews >= 1) base = 15;
  else base = 0;

  // Bonus for high average rating
  if (allReviews.length > 0) {
    const avg =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    if (avg >= 4.5) base = Math.min(40, base + 5);
  }

  return base;
}

async function calcGbpScore(orgId: string): Promise<number> {
  const location = await prisma.gBPLocation.findFirst({
    where: { organizationId: orgId, isPrimary: true },
    select: {
      phone: true,
      website: true,
      locationName: true,
      categories: true,
      hours: true,
    },
  });

  if (!location) return 0;

  let score = 0;
  if (location.phone) score += 5;
  if (location.website) score += 5;
  if (location.locationName) score += 5; // description proxy
  if (location.categories) score += 3;
  if (location.hours) score += 2;

  return score;
}

async function calcContentScore(orgId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Count active/completed campaigns created for this org in last 30 days
  const count = await prisma.campaign.count({
    where: {
      organizationId: orgId,
      status: { in: ['active', 'completed'] },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  if (count >= 8) return 20;
  if (count >= 4) return 12;
  if (count >= 1) return 6;
  return 0;
}

async function triggerReengagementIfNeeded(
  orgId: string,
  currentScore: number
): Promise<void> {
  const previous = await prisma.visibilityScore.findFirst({
    where: {
      organizationId: orgId,
      calculatedAt: { lt: new Date(Date.now() - 7 * 86400000) },
    },
    orderBy: { calculatedAt: 'desc' },
  });

  if (previous && previous.score - currentScore >= 5) {
    logger.warn('visibility-score:re-engagement-trigger', {
      orgId,
      previousScore: previous.score,
      currentScore,
      drop: previous.score - currentScore,
    });
    // Re-engagement email would be queued here — using welcome-sequence pattern
    // Deferred to Phase 2 implementation
  }
}
