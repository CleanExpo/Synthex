/**
 * Core Web Vitals History API
 *
 * GET /api/seo/technical/cwv-history
 * Returns CWV history from stored SEOAudit records.
 *
 * Protected by authentication.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { getCwvHistory } from '@/lib/seo/technical-seo-service';

/**
 * GET /api/seo/technical/cwv-history
 * Get Core Web Vitals history for the authenticated user
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
          error: 'Technical SEO tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Get CWV history
    const history = await getCwvHistory(userId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      history,
      total: history.length,
      message: history.length === 0
        ? 'No SEO audits have been run yet. Run your first audit to start tracking Core Web Vitals.'
        : undefined,
    });
  } catch (error) {
    console.error('CWV History API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch CWV history' },
      500
    );
  }
}
