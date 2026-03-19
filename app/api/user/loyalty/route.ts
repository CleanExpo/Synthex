/**
 * Loyalty Tier API
 *
 * GET /api/user/loyalty — Returns loyalty tier, points, progress, and achievements
 * for the authenticated user.
 *
 * Tier thresholds:
 *   Bronze:   0–499 pts
 *   Silver:   500–1499 pts
 *   Gold:     1500–3999 pts
 *   Platinum: 4000+ pts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import type { UserAchievement } from '@prisma/client';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { ACHIEVEMENTS_CATALOG } from '@/lib/retention/achievements-catalog';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ── Tier thresholds ────────────────────────────────────────────────────────
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 4000,
} as const;

type Tier = keyof typeof TIER_THRESHOLDS;

function computeTier(points: number): Tier {
  if (points >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (points >= TIER_THRESHOLDS.gold) return 'gold';
  if (points >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

function computeNextTierPoints(tier: Tier): number | null {
  switch (tier) {
    case 'bronze':
      return TIER_THRESHOLDS.silver;
    case 'silver':
      return TIER_THRESHOLDS.gold;
    case 'gold':
      return TIER_THRESHOLDS.platinum;
    case 'platinum':
      return null; // Maximum tier
  }
}

function computeTierProgress(points: number, tier: Tier): number {
  const nextTierPoints = computeNextTierPoints(tier);
  if (nextTierPoints === null) return 100; // Platinum — fully maxed

  const tierStart = TIER_THRESHOLDS[tier];
  const range = nextTierPoints - tierStart;
  const progress = points - tierStart;

  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}

// ── Types ──────────────────────────────────────────────────────────────────
// Derived from the Prisma-generated UserAchievement model type — matches the
// exact fields selected in the findMany query below (no unsafe cast needed).
type UserAchievementRecord = Pick<
  UserAchievement,
  | 'achievementId'
  | 'name'
  | 'description'
  | 'icon'
  | 'category'
  | 'rarity'
  | 'progress'
  | 'unlockedAt'
  | 'pointsAwarded'
>;

// ── Handler ────────────────────────────────────────────────────────────────
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
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Organisation scoping: UserStreak and UserAchievement are personal
    // per-user records — they are scoped by userId, not organisationId.
    // The APISecurityChecker (AUTHENTICATED_READ policy) validates that the
    // request carries a valid JWT before we reach this point, so org
    // membership is implicitly confirmed via the authenticated session.

    // Fetch streak (points source) and achievements in parallel
    const [streakRecord, userAchievements] = await Promise.all([
      prisma.userStreak.findUnique({
        where: { userId },
        select: { points: true, level: true, currentStreak: true },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: {
          achievementId: true,
          name: true,
          description: true,
          icon: true,
          category: true,
          rarity: true,
          progress: true,
          unlockedAt: true,
          pointsAwarded: true,
        },
        orderBy: { unlockedAt: 'desc' },
      }),
    ]);

    const points = streakRecord?.points ?? 0;
    const tier = computeTier(points);
    const nextTierPoints = computeNextTierPoints(tier);
    const tierProgress = computeTierProgress(points, tier);

    // Build progress map for fast lookup
    const progressMap = new Map<string, UserAchievementRecord>(
      userAchievements.map(a => [a.achievementId, a])
    );

    // Merge catalog with user progress — include all achievements
    const achievements = ACHIEVEMENTS_CATALOG.map(def => {
      const userProgress = progressMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        rarity: def.rarity,
        points: def.points,
        progress: userProgress?.progress ?? 0,
        isUnlocked: (userProgress?.progress ?? 0) >= 100,
        unlockedAt: userProgress?.unlockedAt?.toISOString() ?? null,
        pointsAwarded: userProgress?.pointsAwarded ?? 0,
      };
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      loyalty: {
        points,
        tier,
        nextTierPoints,
        tierProgress,
        level: streakRecord?.level ?? 1,
        currentStreak: streakRecord?.currentStreak ?? 0,
      },
      achievements,
      stats: {
        totalUnlocked: achievements.filter(a => a.isUnlocked).length,
        totalAvailable: ACHIEVEMENTS_CATALOG.length,
        totalPointsEarned: userAchievements.reduce(
          (sum: number, a: UserAchievementRecord) => sum + a.pointsAwarded,
          0
        ),
      },
    });
  } catch (error) {
    logger.error('Loyalty GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch loyalty data' },
      500
    );
  }
}

export const runtime = 'nodejs';
