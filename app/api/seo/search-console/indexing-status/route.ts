/**
 * Search Console Indexing Status API
 *
 * POST /api/seo/search-console/indexing-status
 * Inspects a URL's indexing status via the URL Inspection API.
 * Uses per-org OAuth if PlatformConnection exists, else service account fallback.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: Service account credentials (REQUIRED for fallback)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { getUrlInspection } from '@/lib/google/search-console-oauth';
import { getIndexingStatus as getIndexingStatusLegacy } from '@/lib/google/search-console';
import { logger } from '@/lib/logger';

// Request validation schema
const IndexingStatusRequestSchema = z.object({
  siteUrl: z.string().url('Invalid site URL'),
  inspectionUrl: z.string().url('Invalid inspection URL'),
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
    const validationResult = IndexingStatusRequestSchema.safeParse(body);

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

    const { siteUrl, inspectionUrl } = validationResult.data;

    // Try OAuth first, fall back to service account
    const organizationId = await getEffectiveOrganizationId(userId);
    const connectionId = organizationId
      ? await findOAuthConnection(organizationId, 'searchconsole')
      : null;

    let inspection;

    if (connectionId) {
      inspection = await getUrlInspection(siteUrl, inspectionUrl, {
        connectionId,
      });
    } else {
      inspection = await getIndexingStatusLegacy(siteUrl, inspectionUrl);
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      inspection,
      source: connectionId ? 'oauth' : 'service_account',
    });
  } catch (error) {
    logger.error('Indexing Status API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to inspect URL indexing status' },
      500
    );
  }
}
