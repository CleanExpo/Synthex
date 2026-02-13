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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { generateDashboardGreeting } from '@/lib/ai/project-manager';

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
      return APISecurityChecker.createSecureResponse({
        success: true,
        upgradeRequired: true,
        requiredPlan: 'business',
        greeting: 'Upgrade to Business to unlock your AI Project Manager',
        suggestions: [],
      });
    }

    // Generate personalized greeting + suggestions
    const { greeting, suggestions } = await generateDashboardGreeting(userId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      greeting,
      suggestions,
    });
  } catch (error) {
    console.error('AI PM suggestions GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate suggestions' },
      500
    );
  }
}
