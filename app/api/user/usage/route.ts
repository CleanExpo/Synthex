/**
 * User Usage API
 *
 * @description Returns current usage stats for billing display
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user from centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get subscription with limits
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Get actual counts
    const [socialAccountsCount, personasCount] = await Promise.all([
      prisma.platformConnection.count({
        where: { userId, isActive: true },
      }),
      prisma.persona.count({
        where: { userId, status: { not: 'archived' } },
      }),
    ]);

    // Default limits for free tier
    const limits = {
      aiPosts: subscription?.maxAiPosts ?? 10,
      socialAccounts: subscription?.maxSocialAccounts ?? 2,
      personas: subscription?.maxPersonas ?? 1,
    };

    const usage = {
      aiPosts: subscription?.currentAiPosts ?? 0,
      socialAccounts: socialAccountsCount,
      personas: personasCount,
    };

    // Calculate percentages for progress bars
    const percentages = {
      aiPosts: limits.aiPosts === -1 ? 0 : Math.min(100, (usage.aiPosts / limits.aiPosts) * 100),
      socialAccounts: limits.socialAccounts === -1 ? 0 : Math.min(100, (usage.socialAccounts / limits.socialAccounts) * 100),
      personas: limits.personas === -1 ? 0 : Math.min(100, (usage.personas / limits.personas) * 100),
    };

    return NextResponse.json({
      usage,
      limits,
      percentages,
      plan: subscription?.plan ?? 'free',
      resetDate: subscription?.lastResetAt?.toISOString(),
      periodEnd: subscription?.currentPeriodEnd?.toISOString(),
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
