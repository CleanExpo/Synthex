/**
 * Schema Markup Extract API
 *
 * POST /api/seo/schema-markup/extract
 * Extracts JSON-LD schema markup from a given URL by fetching the page
 * HTML and parsing <script type="application/ld+json"> tags.
 *
 * Protected by authentication. Requires paid subscription.
 * Falls back to demo data when URL fetch fails.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { extractSchemaFromUrl } from '@/lib/seo/schema-markup-service';
import { logger } from '@/lib/logger';

const extractRequestSchema = z.object({
  url: z.string().url('A valid URL is required'),
});

/**
 * POST /api/seo/schema-markup/extract
 * Extract schema markup from a URL
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
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
          error: 'Schema extraction requires a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = extractRequestSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        400
      );
    }

    const { url } = validation.data;

    // Extract schemas from URL
    const extraction = await extractSchemaFromUrl(url);

    return APISecurityChecker.createSecureResponse({
      success: true,
      extraction,
    });
  } catch (error) {
    logger.error('Schema Markup Extract API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to extract schema from URL' },
      500
    );
  }
}
