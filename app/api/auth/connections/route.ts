/**
 * Platform Connections API
 *
 * @description Lists all platform connections for current user
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error response with details
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { z } from 'zod';
import { getSupportedPlatforms, getOAuthProvider, isSupportedPlatform } from '@/lib/oauth';
import type { OAuthPlatform } from '@/lib/oauth/types';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { decryptField, encryptField } from '@/lib/security/field-encryption';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Zod schema for POST body
const RefreshRequestSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
});

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
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user ID from JWT token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Get all connections for user, scoped by organization
    const connections = await prisma.platformConnection.findMany({
      where: { userId, organizationId: organizationId ?? null, isActive: true },
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
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Validate input with Zod
    const body = await request.json();
    const parseResult = RefreshRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { platform } = parseResult.data;

    // Validate platform is a supported OAuth platform
    if (!isSupportedPlatform(platform)) {
      return NextResponse.json(
        { error: `Unsupported platform: ${platform}` },
        { status: 400 }
      );
    }

    // Now platform is typed as OAuthPlatform
    const validPlatform: OAuthPlatform = platform;

    // Get user ID from JWT token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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

    if (!connection.refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 400 }
      );
    }

    // Decrypt the refresh token for API call
    const decryptedRefreshToken = decryptField(connection.refreshToken);
    if (!decryptedRefreshToken) {
      return NextResponse.json(
        { error: 'Failed to decrypt refresh token' },
        { status: 500 }
      );
    }

    // Refresh the tokens
    const provider = getOAuthProvider(validPlatform);
    const newTokens = await provider.refreshAccessToken(decryptedRefreshToken);

    // Encrypt and update connection in database (accessToken is required)
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptField(newTokens.accessToken) as string,
        refreshToken: newTokens.refreshToken
          ? (encryptField(newTokens.refreshToken) ?? connection.refreshToken)
          : connection.refreshToken, // Keep old encrypted token if no new one
        expiresAt: newTokens.expiresAt,
        lastSync: new Date(),
      },
    });

    logger.info('Tokens refreshed', { platform, userId });

    // Audit log the refresh
    await auditLogger.log({
      userId,
      action: 'auth.tokens_refreshed',
      resource: 'platform_connection',
      resourceId: connection.id,
      category: 'auth',
      severity: 'medium',
      outcome: 'success',
      details: { platform },
    });

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

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
