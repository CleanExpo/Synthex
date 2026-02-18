/**
 * PageSpeed History API
 *
 * GET /api/seo/pagespeed/history
 * Returns PageSpeed analysis history from stored SEOAudit records.
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
import { getPageSpeedHistory } from '@/lib/seo/pagespeed-service';

/**
 * GET /api/seo/pagespeed/history
 * Get PageSpeed analysis history for the authenticated user
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

    // Get history
    const history = await getPageSpeedHistory(userId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      history,
      total: history.length,
      message: history.length === 0
        ? 'No PageSpeed analyses have been run yet. Run your first analysis to start tracking performance.'
        : undefined,
    });
  } catch (error) {
    console.error('PageSpeed History API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch PageSpeed history' },
      500
    );
  }
}
