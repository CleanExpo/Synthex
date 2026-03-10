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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    const connections = await prisma.platformConnection.findMany({
      where: { userId, organizationId: organizationId ?? null, isActive: true },
      select: { platform: true },
    });

    const connectedPlatforms = connections.map((c) => c.platform);
    const allPlatforms = getSupportedPlatforms();

    return NextResponse.json({
      connected: connectedPlatforms.length,
      total: allPlatforms.length,
      platforms: connectedPlatforms,
    });
  } catch (error) {
    logger.error('Failed to get connection status', { error });
    return NextResponse.json({ error: 'Failed to get connection status' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
