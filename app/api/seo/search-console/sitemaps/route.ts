/**
 * Search Console Sitemaps API
 *
 * GET /api/seo/search-console/sitemaps
 * Returns sitemap status from Google Search Console.
 * Uses per-org OAuth if PlatformConnection exists, else service account fallback.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: Service account credentials (OPTIONAL — returns empty list)
 */

import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { listSitemaps } from '@/lib/google/search-console-oauth';
import { getSitemapStatus } from '@/lib/google/search-console';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
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

    // Get siteUrl from query params
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');

    if (!siteUrl) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Missing required query parameter: siteUrl',
        },
        400
      );
    }

    // Basic URL validation
    try {
      new URL(siteUrl);
    } catch {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid siteUrl parameter',
        },
        400
      );
    }

    // Try OAuth first, fall back to service account
    const organizationId = await getEffectiveOrganizationId(userId);
    const connectionId = organizationId
      ? await findOAuthConnection(organizationId, 'searchconsole')
      : null;

    let sitemaps;

    if (connectionId) {
      sitemaps = await listSitemaps(siteUrl, { connectionId });
    } else {
      sitemaps = await getSitemapStatus(siteUrl);
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      sitemaps,
      source: connectionId ? 'oauth' : 'service_account',
    });
  } catch (error) {
    logger.error('Sitemaps API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch sitemap status' },
      500
    );
  }
}
