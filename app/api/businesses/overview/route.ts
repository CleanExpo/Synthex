/**
 * Multi-Business Owner - Cross-Business Overview API
 *
 * GET /api/businesses/overview - Get aggregated statistics across all businesses
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 if database connection fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  isMultiBusinessOwner,
  getCrossBusinessStats
} from '@/lib/multi-business';

/**
 * GET /api/businesses/overview
 *
 * Get aggregated statistics and insights across all owned businesses.
 * Provides cross-business analytics for multi-business owners.
 *
 * Returns:
 * - 200: { overview: CrossBusinessAggregation }
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify multi-business owner status
    const isMBO = await isMultiBusinessOwner(userId);
    if (!isMBO) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Multi-business owner access required' },
        { status: 403 }
      );
    }

    // Get cross-business statistics
    const overview = await getCrossBusinessStats(userId);

    return NextResponse.json({ overview });

  } catch (error) {
    logger.error('[GET /api/businesses/overview] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to fetch overview'
      },
      { status: 500 }
    );
  }
}
