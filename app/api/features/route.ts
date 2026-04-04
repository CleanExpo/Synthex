/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: plan-based feature-flag resolution; intended for future useFeatures() hook.
 */

/**
 * Features API
 *
 * @description Returns available features for the authenticated user based on their plan
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/features
 * Get available features for the current user
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;

    // Get user's subscription to determine features
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });

    const plan = subscription?.plan || 'free';

    // Define features based on plan
    const featuresByPlan: Record<string, string[]> = {
      free: [
        'basic-analytics',
        'single-platform',
        'manual-posting',
        'basic-templates',
      ],
      pro: [
        'basic-analytics',
        'advanced-analytics',
        'multi-platform',
        'scheduled-posting',
        'ai-content-generation',
        'custom-templates',
        'team-collaboration',
      ],
      growth: [
        'basic-analytics',
        'advanced-analytics',
        'multi-platform',
        'scheduled-posting',
        'ai-content-generation',
        'custom-templates',
        'team-collaboration',
        'white-label',
        'api-access',
        'priority-support',
        'custom-integrations',
      ],
      scale: [
        'all-features',
      ],
      // Backward-compat aliases
      professional: [
        'basic-analytics',
        'advanced-analytics',
        'multi-platform',
        'scheduled-posting',
        'ai-content-generation',
        'custom-templates',
        'team-collaboration',
      ],
      business: [
        'basic-analytics',
        'advanced-analytics',
        'multi-platform',
        'scheduled-posting',
        'ai-content-generation',
        'custom-templates',
        'team-collaboration',
        'white-label',
        'api-access',
        'priority-support',
        'custom-integrations',
      ],
      custom: [
        'all-features',
      ],
    };

    const features = featuresByPlan[plan] || featuresByPlan.free;

    return APISecurityChecker.createSecureResponse(
      {
        features,
        plan,
        userId,
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('Error fetching features:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch features' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

