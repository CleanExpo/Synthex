/**
 * Streak API
 *
 * GET /api/gamification/streak - Get current streak data
 * POST /api/gamification/streak - Record daily activity (call on login/dashboard load)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { recordDailyActivity, checkAndUnlockAchievements } from '@/lib/retention/achievement-tracker';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ── Validation ───────────────────────────────────────────────────────────────

const streakBodySchema = z.object({
  source: z.enum(['login', 'dashboard', 'post', 'manual']).optional(),
}).strict().optional();

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

    const streak = await prisma.userStreak.findUnique({
      where: { userId },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      streak: streak || {
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
        level: 1,
        points: 0,
        lastActiveDate: null,
      },
    });
  } catch (error) {
    logger.error('Streak GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch streak' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  // Validate optional body (reject unexpected fields)
  const rawBody = await request.json().catch(() => ({}));
  const parsed = streakBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse({ error: 'User ID not found' }, 401);
    }

    // Record daily activity
    const streakData = await recordDailyActivity(userId);

    // Check achievements (non-blocking in background)
    const achievementResult = await checkAndUnlockAchievements(userId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      streak: streakData,
      newAchievements: achievementResult.unlocked.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        rarity: a.rarity,
        points: a.points,
      })),
    });
  } catch (error) {
    logger.error('Streak POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to record activity' },
      500
    );
  }
}

export const runtime = 'nodejs';
