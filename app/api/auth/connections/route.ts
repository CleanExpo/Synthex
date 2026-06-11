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
import {
  getSupportedPlatforms,
  getOAuthProvider,
  isSupportedPlatform,
} from '@/lib/oauth';
import type { OAuthPlatform } from '@/lib/oauth/types';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { decryptField, encryptField } from '@/lib/security/field-encryption';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
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

    // Get org scope — allow explicit override via query param for business management
    const { searchParams } = new URL(request.url);
    const orgOverride = searchParams.get('organizationId');
    const organizationId =
      orgOverride || (await getEffectiveOrganizationId(userId));

    // If org override requested, verify user owns that organization
    if (orgOverride) {
      const ownership = await prisma.businessOwnership.findFirst({
        where: { ownerId: userId, organizationId: orgOverride },
      });
      if (!ownership) {
        return NextResponse.json(
          { error: 'Access denied to this organization' },
          { status: 403 }
        );
      }
    }

    // Connections belong to the ORGANISATION, not the individual owner who
    // happened to OAuth them. With multiple owners on one brand (e.g. two CEO
    // accounts), scoping by userId hides a connection a co-owner made — so the
    // integration reads "not connected" for everyone but the person who clicked.
    // organizationId here is already access-checked (effective org, or an
    // ownership-verified override), so scope by it. Fall back to userId ONLY for
    // personal/no-org connections — querying organizationId:null alone would leak
    // every other user's null-org rows.
    const connectionWhere = organizationId
      ? { organizationId, isActive: true }
      : { userId, organizationId: null, isActive: true };
    const connections = await prisma.platformConnection.findMany({
      where: connectionWhere,
      orderBy: { updatedAt: 'desc' },
      select: {
        platform: true,
        profileName: true,
        expiresAt: true,
        isActive: true,
        accessToken: true,
        createdAt: true,
        metadata: true,
      },
      take: 50, // max 9 social platforms; 50 is a generous safety cap
    });

    // Build connection status map. Rows are newest-first (orderBy updatedAt desc);
    // keep the FIRST seen per platform so a duplicate/stale row never shadows the
    // freshest connection.
    const connectionMap = new Map<string, (typeof connections)[number]>();
    for (const c of connections) {
      if (!connectionMap.has(c.platform)) connectionMap.set(c.platform, c);
    }

    // Build status for all platforms
    const platforms = getSupportedPlatforms();
    const statuses: ConnectionStatus[] = platforms.map(platform => {
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
      const tokenReadiness = resolvePlatformAccessToken(
        connection.accessToken
      );

      // Avatar can be stored at metadata.avatar (top-level) or metadata.userInfo.avatar
      // (the structure written by the OAuth callback). Check both for backwards compatibility.
      const metadata = connection.metadata as {
        avatar?: string;
        userInfo?: { avatar?: string };
      } | null;
      const avatar =
        metadata?.avatar || metadata?.userInfo?.avatar || undefined;

      return {
        platform,
        connected: connection.isActive && tokenReadiness.ok && !isExpired,
        username: connection.profileName || undefined,
        avatar,
        connectedAt: connection.createdAt,
        expiresAt: connection.expiresAt || undefined,
        isExpired,
        needsRefresh: needsRefresh || !tokenReadiness.ok,
      };
    });

    return NextResponse.json({
      connections: statuses,
      summary: {
        total: platforms.length,
        connected: statuses.filter(s => s.connected).length,
        needsAttention: statuses.filter(s => s.isExpired || s.needsRefresh)
          .length,
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

/**
 * DELETE /api/auth/connections?platform=twitter
 * Disconnect a social platform — soft delete (isActive=false, tokens cleared)
 */
export async function DELETE(request: NextRequest) {
  try {
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

    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    if (!platform) {
      return NextResponse.json(
        { error: 'platform query parameter is required' },
        { status: 400 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    // Verify connection exists before attempting delete
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform,
        organizationId: organizationId ?? null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: `No active connection found for platform: ${platform}` },
        { status: 404 }
      );
    }

    // Soft delete — clear tokens, mark inactive
    await prisma.platformConnection.updateMany({
      where: { userId, platform, organizationId: organizationId ?? null },
      data: {
        isActive: false,
        accessToken: '',
        refreshToken: null,
        updatedAt: new Date(),
      },
    });

    // Audit log the disconnection
    await auditLogger.log({
      userId,
      action: 'social.platform_disconnected',
      resource: 'platform_connection',
      resourceId: connection.id,
      category: 'data',
      severity: 'medium',
      outcome: 'success',
      details: { platform },
    });

    logger.info('Platform disconnected', { platform, userId });

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform} successfully`,
    });
  } catch (error) {
    logger.error('Failed to disconnect platform', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect platform' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
