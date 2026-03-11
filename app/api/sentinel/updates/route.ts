/**
 * Sentinel Algorithm Updates API
 *
 * GET /api/sentinel/updates?days=90
 * Returns algorithm update feed for the given date range.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getRecentUpdates, getAllUpdates, seedAlgorithmUpdates } from '@/lib/sentinel/algorithm-feed';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '90', 10);
    const all = searchParams.get('all') === 'true';

    // Ensure updates are seeded
    await seedAlgorithmUpdates();

    const updates = all ? await getAllUpdates() : await getRecentUpdates(days);

    return APISecurityChecker.createSecureResponse({ updates });
  } catch (error) {
    logger.error('[Sentinel Updates] Error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch algorithm updates' },
      500
    );
  }
}
