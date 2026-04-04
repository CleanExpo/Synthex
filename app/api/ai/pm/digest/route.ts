/**
 * AI PM Weekly Digest API
 *
 * GET /api/ai/pm/digest - Latest weekly digest for user
 *
 * Access: Business plan only ($399/month)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (subscription.plan !== 'business' && subscription.plan !== 'custom') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Project Manager requires a Business subscription',
          upgradeRequired: true,
          requiredPlan: 'business',
        },
        402
      );
    }

    // Get latest digest
    const digest = await prisma.aIWeeklyDigest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        summary: true,
        highlights: true,
        actionItems: true,
        opportunities: true,
        opened: true,
        createdAt: true,
      },
    });

    if (!digest) {
      return APISecurityChecker.createSecureResponse({
        success: true,
        digest: null,
        message: 'No weekly digests yet. Your first digest will arrive Monday morning.',
      });
    }

    // Mark as opened if not already
    if (!digest.opened) {
      await prisma.aIWeeklyDigest.update({
        where: { id: digest.id },
        data: { opened: true, openedAt: new Date() },
      });
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      digest,
    });
  } catch (error) {
    logger.error('AI PM digest GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch digest' },
      500
    );
  }
}

export const runtime = 'nodejs';
