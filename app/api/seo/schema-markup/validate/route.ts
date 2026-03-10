/**
 * Schema Markup Validate API
 *
 * POST /api/seo/schema-markup/validate
 * Validates a JSON-LD schema object for structure, required fields,
 * and field types. Returns validation errors, warnings, and score.
 *
 * Protected by authentication. Requires paid subscription.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { validateSchema } from '@/lib/seo/schema-markup-service';
import { logger } from '@/lib/logger';

const validateRequestSchema = z.object({
  schema: z.record(z.unknown()),
});

/**
 * POST /api/seo/schema-markup/validate
 * Validate a JSON-LD schema object
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
          error: 'Schema validation requires a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestSchema.safeParse(body);

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

    const { schema } = validation.data;

    // Run schema validation
    const result = validateSchema(schema as Record<string, unknown>);

    return APISecurityChecker.createSecureResponse({
      success: true,
      validation: result,
    });
  } catch (error) {
    logger.error('Schema Markup Validate API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to validate schema' },
      500
    );
  }
}
