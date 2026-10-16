/**
 * GEO Readiness History API
 *
 * GET /api/seo/geo-readiness/history
 * Returns GEO analysis history for the authenticated user.
 *
 * Query params:
 * - limit: Number of records to return (default: 20, max: 100)
 *
 * Protected by authentication. Requires paid subscription.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { getAnalysisHistory } from '@/lib/seo/geo-readiness-service';
import { notObserved } from '@/lib/ree/evidence-state';
import { logger } from '@/lib/logger';

/**
 * GET /api/seo/geo-readiness/history
 * Get GEO analysis history for the authenticated user
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
    const subscription =
      await subscriptionService.getOrCreateSubscription(userId);

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

    // Parse optional limit param
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100)
      : 20;

    // Get history
    const reading = await getAnalysisHistory(userId, limit);
    return APISecurityChecker.createSecureResponse(
      reading,
      reading.state === 'OBSERVED' ? 200 : 503
    );
  } catch (error) {
    logger.error('GEO Readiness History API error:', error);
    return APISecurityChecker.createSecureResponse(
      notObserved('UNAVAILABLE', 'GEOAnalysis:personal', 'History read failed'),
      500
    );
  }
}
