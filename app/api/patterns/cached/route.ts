/**
 * Cached Viral Patterns API
 * Returns viral content patterns with Redis caching
 *
 * NOT PROVISIONED: the `viral_patterns` table this route read has no model in
 * prisma/schema.prisma. After auth and org resolution the route answers
 * 501 FEATURE_NOT_PROVISIONED rather than an empty pattern list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedRoute } from '@/lib/middleware/cache-middleware';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

const NOT_PROVISIONED_REASON =
  'Viral patterns are not provisioned: the viral_patterns table does not exist.';

async function handler(req: NextRequest) {
  try {
    // Auth guard
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) return unauthorizedResponse();

    // Resolve org context — deny if no org (prevents cross-org data leak)
    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context found' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'FEATURE_NOT_PROVISIONED',
        message: NOT_PROVISIONED_REASON,
        available: false,
        reason: NOT_PROVISIONED_REASON,
      },
      { status: 501 }
    );
  } catch (error) {
    logger.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export cached version with 5 minute TTL (only 2xx responses are cached)
export const GET = cachedRoute(handler, {
  ttl: 300, // 5 minutes
  varyBy: ['authorization'], // Vary cache by user
  excludeQuery: ['_t'], // Exclude timestamp params from cache key
});
