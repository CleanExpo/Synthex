/**
 * GET /api/auth/connections/status
 * Returns connected platform count summary for the onboarding banner.
 * Lightweight — no token data, no per-platform metadata.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getSupportedPlatforms } from '@/lib/oauth';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    // Scope by ORGANISATION (already access-checked), not the individual owner —
    // a connection made by a co-owner must still count as connected. Fall back to
    // userId only for personal/no-org connections (querying organizationId:null
    // alone would leak other users' null-org rows).
    const connectionWhere = organizationId
      ? { organizationId, isActive: true }
      : { userId, organizationId: null, isActive: true };

    const connections = await prisma.platformConnection.findMany({
      where: connectionWhere,
      select: { platform: true, accessToken: true, expiresAt: true },
      take: 50,
    });

    // De-dup platforms (an org can have a connection from more than one owner).
    const connectedPlatforms = [
      ...new Set(
        connections
          .filter(c => {
            const expired = c.expiresAt
              ? c.expiresAt.getTime() < Date.now()
              : false;
            return !expired && resolvePlatformAccessToken(c.accessToken).ok;
          })
          .map(c => c.platform)
      ),
    ];
    const allPlatforms = getSupportedPlatforms();

    return NextResponse.json({
      connected: connectedPlatforms.length,
      total: allPlatforms.length,
      platforms: connectedPlatforms,
    });
  } catch (error) {
    logger.error('Failed to get connection status', { error });
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
