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
import type { Prisma } from '@prisma/client';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import {
  getEffectiveOrganizationId,
  hasOrganizationAccess,
} from '@/lib/multi-business';
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
import { evaluateProactiveReconnect } from '@/lib/platform-connections/reconnect-policy';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Zod schema for POST body
const RefreshRequestSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
});

/**
 * Resolve the organisation scope for a connections action.
 *
 * Honours an explicit `?organizationId=` override (used by multi-business
 * owners viewing/managing a specific brand's connections) and access-checks it
 * against `businessOwnership` — exactly as the sibling `/api/integrations`
 * route does. Without this, GET (the list) honoured the override while POST
 * (refresh) and DELETE (disconnect) silently fell back to
 * `getEffectiveOrganizationId`, so a brand-scoped disconnect/refresh acted on
 * the WRONG (active) org — either no-op'ing against the viewed brand or
 * mutating a different brand's connection (#420/#60/#417 class).
 */
async function resolveConnectionOrgScope(
  request: NextRequest,
  userId: string
): Promise<
  | { ok: true; organizationId: string | null }
  | { ok: false; response: NextResponse }
> {
  const { searchParams } = new URL(request.url);
  const orgOverride = searchParams.get('organizationId');
  const organizationId =
    orgOverride || (await getEffectiveOrganizationId(userId));

  if (!orgOverride) {
    return { ok: true, organizationId };
  }

  // Verify ACTIVE access to the overridden org — hasOrganizationAccess gates on
  // direct membership, active BusinessOwnership (isActive) and workspace
  // parent/child membership, so a revoked owner is denied (unlike a raw
  // ownership-row existence check that ignores isActive).
  if (!(await hasOrganizationAccess(userId, orgOverride))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, organizationId };
}

/**
 * Error strings that mean the refresh token itself is dead — the connection
 * cannot self-heal and the user must re-authenticate. Mirrors the proactive
 * `cron/refresh-tokens` permanent-failure list so the manual "Refresh" button
 * surfaces a dead connection the same way the cron does, instead of dead-ending
 * with an opaque 500 while the row stays isActive with a dead token.
 */
const PERMANENT_REFRESH_FAILURE_PATTERNS = [
  'invalid_grant',
  'invalid_token',
  'token_expired',
  'refresh_token_expired',
  'authorization_revoked',
  'access_denied',
  'invalid_client',
  'account_disabled',
  'user_not_found',
  'invalid refresh token',
  'refresh token has expired',
  'token has been expired or revoked',
  'the refresh token has already been used',
  'this token has expired',
  'cannot refresh as refresh token has expired',
  'error validating access token',
  'session has been invalidated',
  'the token has no data',
];

function isPermanentRefreshFailure(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return PERMANENT_REFRESH_FAILURE_PATTERNS.some(p => lower.includes(p));
}

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
  /**
   * True when a connection row EXISTS but its stored token could not be
   * decrypted (wrong/rotated/missing encryption key). The account is NOT
   * absent — it needs reconnecting. Without this, a key mismatch is
   * indistinguishable from "never connected" and the drop is silent.
   */
  needsReconnect?: boolean;
  /** Human-readable reason when needsReconnect is true (no secrets). */
  reconnectReason?: string;
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

    // Get org scope — allow explicit override via query param for business
    // management (ownership-verified inside the helper).
    const scope = await resolveConnectionOrgScope(request, userId);
    if (!scope.ok) return scope.response;
    const { organizationId } = scope;

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
        refreshToken: true,
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
      const tokenReadiness = resolvePlatformAccessToken(connection.accessToken);

      // A stored token that won't decrypt = encryption key mismatch. The
      // account WAS connected; the key changed underneath it. Surface this as
      // "reconnect needed" rather than a silent "not connected", and log it so
      // a rotated/wrong key is visible in ops, not invisible.
      const keyMismatch = tokenReadiness.keyMismatch === true;
      if (keyMismatch) {
        logger.error('Connection token failed to decrypt — key mismatch', {
          platform,
          organizationId,
          reason: tokenReadiness.reason,
        });
      }

      // SYN-1003: a connection with no refresh token (e.g. LinkedIn, which is
      // not enrolled in LinkedIn's refresh-token program) cannot self-heal — it
      // dies at expiresAt (~60 days) with no warning. Flag it for reconnect a
      // few days BEFORE expiry instead of pretending it auto-refreshes.
      const proactive = evaluateProactiveReconnect(
        {
          expiresAt: connection.expiresAt ?? null,
          hasRefreshToken: Boolean(connection.refreshToken),
        },
        platform
      );

      const needsReconnect = keyMismatch || proactive.needsReconnect;
      const reconnectReason = keyMismatch
        ? 'Stored credentials could not be decrypted (encryption key mismatch). Please reconnect this account.'
        : proactive.needsReconnect
          ? proactive.reason
          : undefined;

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
        needsReconnect,
        reconnectReason,
      };
    });

    return NextResponse.json({
      connections: statuses,
      summary: {
        total: platforms.length,
        connected: statuses.filter(s => s.connected).length,
        needsAttention: statuses.filter(s => s.isExpired || s.needsRefresh)
          .length,
        // Surfaced separately so a key mismatch is never silently bucketed as
        // "not connected" — these accounts need a reconnect, not a re-OAuth-from-scratch.
        needsReconnect: statuses.filter(s => s.needsReconnect).length,
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

    // Get org scope for multi-business support — honour the ownership-verified
    // `?organizationId=` override so a refresh acts on the brand the caller is
    // viewing, not just their active org.
    const scope = await resolveConnectionOrgScope(request, userId);
    if (!scope.ok) return scope.response;
    const { organizationId } = scope;
    const connectionWhere = organizationId
      ? { organizationId, platform, isActive: true }
      : { userId, platform, organizationId: null, isActive: true };

    // Find the connection, scoped by organization
    const connection = await prisma.platformConnection.findFirst({
      where: connectionWhere,
      orderBy: { updatedAt: 'desc' },
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
    let newTokens;
    try {
      newTokens = await provider.refreshAccessToken(decryptedRefreshToken);
    } catch (refreshError) {
      const refreshMessage =
        refreshError instanceof Error
          ? refreshError.message
          : String(refreshError);

      // A permanent failure (revoked / invalid_grant / expired refresh token)
      // cannot be recovered without re-authenticating. Mirror the cron: disable
      // the connection, flag requires_reauth, notify the user, and return a
      // clear "reconnect needed" signal — NOT an opaque 500 that leaves the row
      // active with a dead token.
      if (isPermanentRefreshFailure(refreshMessage)) {
        logger.warn(
          'Manual refresh hit a permanent auth failure — disabling connection',
          { platform, userId, connectionId: connection.id }
        );

        const existingMeta =
          (connection.metadata as Record<string, unknown>) ?? {};
        await prisma.platformConnection.update({
          where: { id: connection.id },
          data: {
            isActive: false,
            metadata: {
              ...existingMeta,
              authStatus: 'requires_reauth',
              authFailedAt: new Date().toISOString(),
              authFailureReason: refreshMessage,
            },
          },
        });

        const platformLabel =
          platform.charAt(0).toUpperCase() + platform.slice(1);
        const accountLabel = connection.profileName
          ? ` (${connection.profileName})`
          : '';
        try {
          await prisma.notification.create({
            data: {
              userId,
              type: 'platform_reauth_required',
              title: `Reconnect your ${platformLabel} account`,
              message: `Your ${platformLabel}${accountLabel} connection has expired and needs to be reconnected. Go to Platforms → ${platformLabel} and click Reconnect to restore posting.`,
              data: {
                connectionId: connection.id,
                platform,
                profileName: connection.profileName ?? null,
              },
              read: false,
            },
          });
        } catch (notifyError) {
          logger.error(
            'Failed to create reauth notification after manual refresh failure',
            { platform, userId, error: notifyError }
          );
        }

        await auditLogger.log({
          userId,
          action: 'auth.tokens_refresh_failed',
          resource: 'platform_connection',
          resourceId: connection.id,
          category: 'auth',
          severity: 'high',
          outcome: 'failure',
          details: { platform, permanent: true },
        });

        return NextResponse.json(
          {
            error: `Your ${platformLabel} connection has expired and needs to be reconnected.`,
            needsReconnect: true,
            platform,
          },
          { status: 409 }
        );
      }

      // Transient failure (rate limit, network, platform 5xx) — leave the
      // connection active so it can be retried, and surface a clear message.
      throw refreshError;
    }

    // Encrypt and update connection in database (accessToken is required).
    // Clear any stale requires_reauth flag a prior failure left behind, so a
    // recovered connection no longer reads as "needs reconnect".
    const existingMeta = (connection.metadata as Record<string, unknown>) ?? {};
    const {
      authStatus: _authStatus,
      authFailedAt: _authFailedAt,
      authFailureReason: _authFailureReason,
      ...cleanedMeta
    } = existingMeta;
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptField(newTokens.accessToken) as string,
        refreshToken: newTokens.refreshToken
          ? (encryptField(newTokens.refreshToken) ?? connection.refreshToken)
          : connection.refreshToken, // Keep old encrypted token if no new one
        expiresAt: newTokens.expiresAt,
        lastSync: new Date(),
        metadata: cleanedMeta as Prisma.InputJsonValue,
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

    // Honour the ownership-verified `?organizationId=` override so a disconnect
    // acts on the brand the caller is viewing (the platforms page sends it),
    // not just their active org — otherwise the GET shows brand B's accounts
    // while the DELETE silently targets brand A.
    const scope = await resolveConnectionOrgScope(request, userId);
    if (!scope.ok) return scope.response;
    const { organizationId } = scope;
    const connectionWhere = organizationId
      ? { organizationId, platform, isActive: true }
      : { userId, platform, organizationId: null, isActive: true };

    // Verify connection exists before attempting delete
    const connection = await prisma.platformConnection.findFirst({
      where: connectionWhere,
      orderBy: { updatedAt: 'desc' },
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
      where: organizationId
        ? { organizationId, platform }
        : { userId, platform, organizationId: null },
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
