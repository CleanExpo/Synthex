/**
 * Platform Connections API
 *
 * @description Lists all platform connections for current user
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupportedPlatforms, getOAuthProvider } from '@/lib/oauth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

interface ConnectionStatus {
  platform: string;
  connected: boolean;
  username?: string;
  avatar?: string;
  connectedAt?: Date;
  expiresAt?: Date;
  isExpired: boolean;
  needsRefresh: boolean;
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/auth/connections
 * List all platform connections for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session (simplified)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const userId = sessionCookie?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all connections for user
    const connections = await prisma.platformConnection.findMany({
      where: { userId, isActive: true },
      select: {
        platform: true,
        profileName: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Build connection status map
    const connectionMap = new Map(
      connections.map((c) => [c.platform, c])
    );

    // Build status for all platforms
    const platforms = getSupportedPlatforms();
    const statuses: ConnectionStatus[] = platforms.map((platform) => {
      const connection = connectionMap.get(platform);

      if (!connection) {
        return {
          platform,
          connected: false,
          isExpired: false,
          needsRefresh: false,
        };
      }

      const provider = getOAuthProvider(platform);
      const isExpired = connection.expiresAt
        ? new Date(connection.expiresAt).getTime() < Date.now()
        : false;
      const needsRefresh = connection.expiresAt
        ? provider.isTokenExpired({
            accessToken: '',
            expiresAt: connection.expiresAt,
          })
        : false;

      const metadata = connection.metadata as { avatar?: string } | null;

      return {
        platform,
        connected: connection.isActive,
        username: connection.profileName || undefined,
        avatar: metadata?.avatar || undefined,
        connectedAt: connection.createdAt,
        expiresAt: connection.expiresAt || undefined,
        isExpired,
        needsRefresh,
      };
    });

    return NextResponse.json({
      connections: statuses,
      summary: {
        total: platforms.length,
        connected: statuses.filter((s) => s.connected).length,
        needsAttention: statuses.filter((s) => s.isExpired || s.needsRefresh).length,
      },
    });
  } catch (error) {
    logger.error('Failed to get connections', { error });

    return NextResponse.json(
      { error: 'Failed to get connections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/connections/refresh
 * Refresh tokens for a platform
 */
export async function POST(request: NextRequest) {
  try {
    const { platform } = await request.json();

    // Get user ID from session (simplified)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const userId = sessionCookie?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the connection
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    if (!connection.refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 400 }
      );
    }

    // Refresh the tokens
    const provider = getOAuthProvider(platform);
    const newTokens = await provider.refreshAccessToken(connection.refreshToken);

    // Update connection in database
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || connection.refreshToken,
        expiresAt: newTokens.expiresAt,
        lastSync: new Date(),
      },
    });

    logger.info('Tokens refreshed', { platform, userId });

    return NextResponse.json({
      success: true,
      expiresAt: newTokens.expiresAt,
    });
  } catch (error) {
    logger.error('Failed to refresh tokens', { error });

    return NextResponse.json(
      { error: 'Failed to refresh tokens' },
      { status: 500 }
    );
  }
}
