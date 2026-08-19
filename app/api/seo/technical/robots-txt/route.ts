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
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { requireEntitlement } from '@/lib/billing/require-entitlement';
import { validateRobotsTxt } from '@/lib/seo/technical-seo-service';
import { assertExternalUrlSafe } from '@/lib/security/validate-url';
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

    // Subscription gate — Professional plan or higher (status-aware, fails
    // closed on a missing or unpaid/past-due subscription).
    const entitlement = await requireEntitlement(userId, 'seo');
    if (!entitlement.allowed) {
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
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { url } = validationResult.data;

    // SSRF guard: robots.txt is fetched server-side. Block private/loopback/
    // metadata targets (DNS-resolving async check) before the fetch.
    try {
      await assertExternalUrlSafe(url);
    } catch {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Invalid URL' },
        400
      );
    }

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
