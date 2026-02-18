/**
 * GEO Readiness Trends API
 *
 * GET /api/seo/geo-readiness/trends
 * Returns aggregated GEO score trend data (daily averages).
 *
 * Query params:
 * - days: Number of days to look back (default: 30, max: 90)
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
import { getScoreTrends } from '@/lib/seo/geo-readiness-service';

/**
 * GET /api/seo/geo-readiness/trends
 * Get GEO score trend data for the authenticated user
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
          error: 'GEO Readiness tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Parse optional days param
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90) : 30;

    // Get trends
    const { trends, period, isDemo } = await getScoreTrends(userId, days);

    return APISecurityChecker.createSecureResponse({
      success: true,
      trends,
      period,
      isDemo,
      message: isDemo
        ? 'Showing demo data. Run your first analysis to see real trends.'
        : undefined,
    });
  } catch (error) {
    console.error('GEO Readiness Trends API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch GEO score trends' },
      500
    );
  }
}
