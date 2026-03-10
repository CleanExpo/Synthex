/**
 * Robots.txt Validation API
 *
 * POST /api/seo/technical/robots-txt
 * Fetches and validates robots.txt, checking directives and AI bot access.
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
import { validateRobotsTxt } from '@/lib/seo/technical-seo-service';
import { logger } from '@/lib/logger';

// Request validation schema
const RobotsTxtRequestSchema = z.object({
  url: z.string().url('Invalid URL provided'),
});

/**
 * POST /api/seo/technical/robots-txt
 * Validate robots.txt for a URL
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
    const validationResult = RobotsTxtRequestSchema.safeParse(body);

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

    // Validate robots.txt
    const robotsTxt = await validateRobotsTxt(url);

    return APISecurityChecker.createSecureResponse({
      success: true,
      robotsTxt,
    });
  } catch (error) {
    logger.error('Robots.txt Validation API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to validate robots.txt' },
      500
    );
  }
}
