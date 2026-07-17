/**
 * AI PM Suggestions API
 *
 * GET /api/ai/pm/suggestions - Proactive suggestions for dashboard widget
 * Called on dashboard load to populate the AI PM widget.
 *
 * Access: Business plan only ($399/month)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 */

import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { generateDashboardGreeting } from '@/lib/ai/project-manager';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/lib/billing/require-entitlement';

async function _handleGet(request: NextRequest) {
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

    // Subscription gate — Business plan (status-aware, fails closed on a
    // missing or unpaid/past-due subscription).
    const entitlement = await requireEntitlement(userId, 'ai_pm');
    if (!entitlement.allowed) {
      // Fail closed: an unentitled user gets NO generated suggestions. The
      // upsell body is preserved for the dashboard card, but the response is an
      // honest 402 with success:false — never a 200 success on a denied gate.
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          upgradeRequired: true,
          requiredPlan: 'business',
          greeting: 'Upgrade to Business to unlock your AI Project Manager',
          suggestions: [],
        },
        402
      );
    }

    // Generate personalized greeting + suggestions
    const { greeting, suggestions } = await generateDashboardGreeting(userId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      greeting,
      suggestions,
    });
  } catch (error) {
    logger.error('AI PM suggestions GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate suggestions' },
      500
    );
  }
}

// RA-3024 — rate-limited wrapper around the existing handler.
export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => _handleGet(request));
}
