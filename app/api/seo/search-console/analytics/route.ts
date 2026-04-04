/**
 * Search Console Analytics API
 *
 * POST /api/seo/search-console/analytics
 * Returns search performance data from Google Search Console.
 * Uses per-org OAuth if PlatformConnection exists, else service account fallback.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: Service account credentials (OPTIONAL — falls back to demo data)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { getSearchAnalytics as getSearchAnalyticsOAuth } from '@/lib/google/search-console-oauth';
import { getSearchAnalytics as getSearchAnalyticsLegacy } from '@/lib/google/search-console';
import { logger } from '@/lib/logger';

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
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { siteUrl, startDate, endDate, dimensions, rowLimit } =
      validationResult.data;

    // Try OAuth first, fall back to service account
    const organizationId = await getEffectiveOrganizationId(userId);
    const connectionId = organizationId
      ? await findOAuthConnection(organizationId, 'searchconsole')
      : null;

    let analytics;

    if (connectionId) {
      // Per-org OAuth path
      analytics = await getSearchAnalyticsOAuth(
        siteUrl,
        { startDate, endDate, dimensions, rowLimit },
        { connectionId }
      );
    } else {
      // Legacy service account fallback (returns demo data if not configured)
      analytics = await getSearchAnalyticsLegacy(siteUrl, {
        startDate,
        endDate,
        dimensions,
        rowLimit,
      });
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      analytics,
      source: connectionId ? 'oauth' : 'service_account',
    });
  } catch (error) {
    logger.error('Search Console Analytics API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch search analytics' },
      500
    );
  }
}
