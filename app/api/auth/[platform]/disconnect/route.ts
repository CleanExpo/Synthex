/**
 * OAuth Disconnect Route
 *
 * @description Disconnects a platform and revokes tokens
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific credentials (see individual providers)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSupportedPlatform, revokePlatformTokens } from '@/lib/oauth';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    // Validate platform
    if (!isSupportedPlatform(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Get user ID from JWT token (auth-token cookie or Authorization header)
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Find the connection, scoped by organization
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform,
        organizationId: organizationId ?? null,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Revoke tokens at the platform
    try {
      await revokePlatformTokens(platform as Parameters<typeof revokePlatformTokens>[0], connection.accessToken);
    } catch (error) {
      // Log but continue - we'll still remove the connection
      logger.warn('Failed to revoke tokens at platform', { platform, error });
    }

    // Soft delete - mark as inactive
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    });

    logger.info('Platform disconnected', { platform, userId });

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform}`,
    });
  } catch (error) {
    logger.error('OAuth disconnect error', { error });

    return NextResponse.json(
      { error: 'Failed to disconnect platform' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
