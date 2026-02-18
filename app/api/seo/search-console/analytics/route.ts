/**
 * Search Console Analytics API
 *
 * POST /api/seo/search-console/analytics
 * Returns search performance data from Google Search Console.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: Service account credentials (OPTIONAL — falls back to demo data)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getSearchAnalytics } from '@/lib/google/search-console';

// Request validation schema
const AnalyticsRequestSchema = z.object({
  siteUrl: z.string().url('Invalid site URL'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  dimensions: z
    .array(z.enum(['query', 'page', 'country', 'device']))
    .optional()
    .default(['query']),
  rowLimit: z.number().min(1).max(1000).optional().default(25),
});

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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = AnalyticsRequestSchema.safeParse(body);

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

    const { siteUrl, startDate, endDate, dimensions, rowLimit } = validationResult.data;

    const analytics = await getSearchAnalytics(siteUrl, {
      startDate,
      endDate,
      dimensions,
      rowLimit,
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Search Console Analytics API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch search analytics' },
      500
    );
  }
}
