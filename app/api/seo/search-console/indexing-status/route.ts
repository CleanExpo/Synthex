/**
 * Search Console Indexing Status API
 *
 * POST /api/seo/search-console/indexing-status
 * Inspects a URL's indexing status via the URL Inspection API.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: Service account credentials (REQUIRED)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getIndexingStatus } from '@/lib/google/search-console';

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
          details: validationResult.error.errors,
        },
        400
      );
    }

    const { siteUrl, inspectionUrl } = validationResult.data;

    const inspection = await getIndexingStatus(siteUrl, inspectionUrl);

    return APISecurityChecker.createSecureResponse({
      success: true,
      inspection,
    });
  } catch (error) {
    console.error('Indexing Status API error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to inspect URL indexing status';
    return APISecurityChecker.createSecureResponse(
      { error: message },
      500
    );
  }
}
