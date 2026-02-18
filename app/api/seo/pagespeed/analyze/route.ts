/**
 * PageSpeed Analyze API
 *
 * POST /api/seo/pagespeed/analyze
 * Runs a PageSpeed Insights analysis on the provided URL.
 *
 * Protected by authentication. Requires paid subscription.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * ENVIRONMENT VARIABLES OPTIONAL:
 * - GOOGLE_PAGESPEED_API_KEY: For higher rate limits
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { runPageSpeedAnalysis } from '@/lib/seo/pagespeed-service';

const analyzeSchema = z.object({
  url: z.string().url('A valid URL is required'),
  strategy: z.enum(['mobile', 'desktop']).optional().default('mobile'),
});

/**
 * POST /api/seo/pagespeed/analyze
 * Run PageSpeed analysis on a URL
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
          error: 'PageSpeed tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = analyzeSchema.safeParse(body);

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

    const { url, strategy } = validation.data;

    // Run analysis
    const analysis = await runPageSpeedAnalysis(url, strategy);

    return APISecurityChecker.createSecureResponse({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('PageSpeed Analyze API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to run PageSpeed analysis' },
      500
    );
  }
}
