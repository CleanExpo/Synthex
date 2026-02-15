/**
 * Achievements API
 *
 * GET /api/gamification/achievements - All achievements (unlocked + locked with progress)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { ACHIEVEMENTS_CATALOG } from '@/lib/retention/achievements-catalog';
import prisma from '@/lib/prisma';

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

    // Get user's achievement progress
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      select: {
        achievementId: true,
        progress: true,
        unlockedAt: true,
        pointsAwarded: true,
      },
    });

    const progressMap = new Map(
      userAchievements.map((a) => [a.achievementId, a])
    );

    // Merge catalog with user progress
    const achievements = ACHIEVEMENTS_CATALOG.map((def) => {
      const userProgress = progressMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        rarity: def.rarity,
        points: def.points,
        progress: userProgress?.progress || 0,
        unlockedAt: userProgress?.unlockedAt || null,
        isUnlocked: (userProgress?.progress || 0) >= 100,
      };
    });

    // Stats
    const totalUnlocked = achievements.filter((a) => a.isUnlocked).length;
    const totalPoints = userAchievements.reduce((sum, a) => sum + a.pointsAwarded, 0);

    return APISecurityChecker.createSecureResponse({
      success: true,
      achievements,
      stats: {
        totalUnlocked,
        totalAvailable: ACHIEVEMENTS_CATALOG.length,
        totalPoints,
        completionPercent: Math.round((totalUnlocked / ACHIEVEMENTS_CATALOG.length) * 100),
      },
    });
  } catch (error) {
    console.error('Achievements GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch achievements' },
      500
    );
  }
}

export const runtime = 'nodejs';
