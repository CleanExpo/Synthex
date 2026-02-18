/**
 * Mobile Parity Check API
 *
 * POST /api/seo/technical/mobile-parity
 * Compares mobile vs desktop PageSpeed results to identify parity issues.
 *
 * Protected by authentication.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { checkMobileParity } from '@/lib/seo/technical-seo-service';

// Request validation schema
const MobileParityRequestSchema = z.object({
  url: z.string().url('Invalid URL provided'),
});

/**
 * POST /api/seo/technical/mobile-parity
 * Check mobile/desktop parity for a URL
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = MobileParityRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        400
      );
    }

    const { url } = validationResult.data;

    // Perform mobile parity check
    const mobileParity = await checkMobileParity(url);

    return APISecurityChecker.createSecureResponse({
      success: true,
      mobileParity,
    });
  } catch (error) {
    console.error('Mobile Parity API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to check mobile parity' },
      500
    );
  }
}
