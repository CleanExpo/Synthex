/**
 * PageSpeed Trends API
 *
 * GET /api/seo/pagespeed/trends
 * Returns aggregated performance trend data (daily averages).
 *
 * Query params:
 * - days: Number of days to look back (default: 30)
 *
 * Protected by authentication. Requires paid subscription.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { getPerformanceTrends } from '@/lib/seo/pagespeed-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/seo/pagespeed/trends
 * Get performance trend data for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Security check
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

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Check if user has SEO access
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'PageSpeed tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Parse optional days param
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365) : 30;

    // Get trends
    const trends = await getPerformanceTrends(userId, days);

    return APISecurityChecker.createSecureResponse({
      success: true,
      trends,
      days,
    });
  } catch (error) {
    logger.error('PageSpeed Trends API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch performance trends' },
      500
    );
  }
}
