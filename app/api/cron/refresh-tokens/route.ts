/**
 * Proactive Token Refresh Cron Job
 *
 * GET /api/cron/refresh-tokens
 * Runs every 6 hours via Vercel Cron.
 *
 * PURPOSE:
 * Token refresh currently only happens inside publish-scheduled — meaning if a
 * user has no posts queued, their OAuth tokens silently expire. When they
 * eventually do post, the access token is dead AND the refresh token may have
 * expired too (Twitter: 6 months, LinkedIn: 365 days, TikTok: 365 days).
 *
 * This cron proactively refreshes every active connection whose token expires
 * within the next 24 hours, keeping them perpetually valid.
 *
 * PERMANENT FAILURE HANDLING:
 * Some refresh failures are permanent (invalid_grant, revoked token, account
 * suspended). When detected, this cron:
 *   1. Sets isActive=false on the PlatformConnection
 *   2. Stores authStatus: 'requires_reauth' in metadata with reason
 *   3. Sends the user an in-app notification to reconnect
 *
 * TRANSIENT FAILURE HANDLING:
 * Rate limits, network errors, and platform 5xx responses are left as-is.
 * The connection stays active and will be retried on the next 6-hour run.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL:           PostgreSQL connection (CRITICAL)
 * - CRON_SECRET:            Vercel cron secret for authorisation (SECRET)
 * - FIELD_ENCRYPTION_KEY:   AES-256 key for token encryption (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  createPlatformService,
  isPlatformSupported,
  type SupportedPlatform,
  type PlatformCredentials,
} from '@/lib/social';
import { decryptFieldSafe, encryptField } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Refresh tokens expiring within this many hours */
const REFRESH_WINDOW_HOURS = 24;

/**
 * Error strings that indicate the refresh token itself is dead.
 * These cannot be recovered without the user re-authenticating —
 * the connection must be disabled and the user notified.
 */
const PERMANENT_FAILURE_PATTERNS = [
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
  'the refresh token has already been used', // Twitter token rotation
  'this token has expired',                  // Twitter
  'cannot refresh as refresh token has expired', // LinkedIn
  'error validating access token',           // Facebook/Instagram
  'session has been invalidated',            // Facebook/Instagram
  'the token has no data',                   // TikTok
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPermanentFailure(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return PERMANENT_FAILURE_PATTERNS.some((p) => lower.includes(p));
}

async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data as Record<string, string | number | boolean | null>,
        read: false,
      },
    });
  } catch (error) {
    logger.error('[refresh-tokens] Failed to create notification', { userId, type, error });
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Authorisation ---------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();
  const refreshWindowEnd = new Date(now.getTime() + REFRESH_WINDOW_HOURS * 60 * 60 * 1000);

  logger.info('cron:refresh-tokens:start', {
    timestamp: now.toISOString(),
    refreshWindowEnd: refreshWindowEnd.toISOString(),
  });

  // -- Find connections needing refresh --------------------------------------
  // Includes:
  //   (a) Tokens expiring within the 24h window (refresh before they die)
  //   (b) Already-expired tokens (missed a previous refresh window)
  const connections = await prisma.platformConnection.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { expiresAt: { gte: now, lte: refreshWindowEnd } }, // expiring soon
        { expiresAt: { lt: now } },                          // already expired
      ],
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      profileName: true,
      metadata: true,
    },
  });

  logger.info('cron:refresh-tokens:found', { count: connections.length });

  let refreshed = 0;
  let skipped = 0;
  let transientFailed = 0;
  let permanentFailed = 0;

  // -- Process each connection independently ---------------------------------
  for (const connection of connections) {
    const { id, userId, platform, profileName } = connection;

    try {
      // Skip unsupported platforms
      if (!isPlatformSupported(platform)) {
        logger.warn('[refresh-tokens] Unsupported platform — skipping', { id, platform });
        skipped++;
        continue;
      }

      // Decrypt tokens
      const accessToken = decryptFieldSafe(connection.accessToken);
      const refreshToken = connection.refreshToken
        ? decryptFieldSafe(connection.refreshToken)
        : undefined;

      if (!accessToken) {
        logger.error('[refresh-tokens] Cannot decrypt access token — skipping', { id, platform });
        skipped++;
        continue;
      }

      // Without a refresh token we cannot proactively refresh —
      // the publish-scheduled cron will surface the error when needed.
      if (!refreshToken) {
        logger.info('[refresh-tokens] No refresh token available — skipping', { id, platform });
        skipped++;
        continue;
      }

      const credentials: PlatformCredentials = {
        accessToken,
        refreshToken,
        expiresAt: connection.expiresAt ?? undefined,
      };

      // -- Create service with persist callback ------------------------------
      const service = createPlatformService(
        platform as SupportedPlatform,
        credentials,
        {
          // Callback fires inside ensureValidToken() if it runs first;
          // we also persist directly after refreshToken() below as a safety net.
          tokenRefreshCallback: async (_p: string, newCreds: PlatformCredentials) => {
            await prisma.platformConnection.update({
              where: { id },
              data: {
                accessToken: encryptField(newCreds.accessToken) ?? newCreds.accessToken,
                ...(newCreds.refreshToken !== undefined && {
                  refreshToken: encryptField(newCreds.refreshToken) ?? newCreds.refreshToken,
                }),
                expiresAt: newCreds.expiresAt ?? null,
                updatedAt: new Date(),
              },
            });
          },
        }
      );

      if (!service || !service.refreshToken) {
        logger.info('[refresh-tokens] Platform service has no refreshToken() — skipping', { id, platform });
        skipped++;
        continue;
      }

      // -- Perform refresh ---------------------------------------------------
      logger.info('[refresh-tokens] Refreshing token', {
        id,
        platform,
        expiresAt: connection.expiresAt,
        alreadyExpired: connection.expiresAt ? connection.expiresAt < now : false,
      });

      const newCredentials = await service.refreshToken();

      // Persist directly (belt-and-suspenders — callback may not have fired)
      await prisma.platformConnection.update({
        where: { id },
        data: {
          accessToken: encryptField(newCredentials.accessToken) ?? newCredentials.accessToken,
          ...(newCredentials.refreshToken !== undefined && {
            refreshToken:
              encryptField(newCredentials.refreshToken) ?? newCredentials.refreshToken,
          }),
          expiresAt: newCredentials.expiresAt ?? null,
          updatedAt: new Date(),
        },
      });

      logger.info('[refresh-tokens] Token refreshed successfully', {
        id,
        platform,
        newExpiresAt: newCredentials.expiresAt,
      });

      refreshed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[refresh-tokens] Token refresh failed', {
        id,
        platform,
        error: errorMessage,
      });

      if (isPermanentFailure(errorMessage)) {
        // ----------------------------------------------------------------
        // Permanent failure — the refresh token itself is dead.
        // Disable the connection and alert the user to reconnect.
        // ----------------------------------------------------------------
        logger.warn('[refresh-tokens] Permanent auth failure — disabling connection', {
          id,
          platform,
          error: errorMessage,
        });

        try {
          const existingMeta = (connection.metadata as Record<string, unknown>) ?? {};
          await prisma.platformConnection.update({
            where: { id },
            data: {
              isActive: false,
              metadata: {
                ...existingMeta,
                authStatus: 'requires_reauth',
                authFailedAt: new Date().toISOString(),
                authFailureReason: errorMessage,
              },
            },
          });

          const platformLabel =
            platform.charAt(0).toUpperCase() + platform.slice(1);
          const accountLabel = profileName ? ` (${profileName})` : '';

          await createNotification(
            userId,
            'platform_reauth_required',
            `Reconnect your ${platformLabel} account`,
            `Your ${platformLabel}${accountLabel} connection has expired and needs to be reconnected. Go to Platforms → ${platformLabel} and click Reconnect to restore posting.`,
            { connectionId: id, platform, profileName: profileName ?? null }
          );
        } catch (updateError) {
          logger.error(
            '[refresh-tokens] Failed to disable connection after permanent failure',
            { id, platform, error: updateError }
          );
        }

        permanentFailed++;
      } else {
        // Transient failure (rate limit, network error, platform 5xx).
        // Leave the connection active — will retry on next 6-hour run.
        transientFailed++;
      }
    }
  }

  const duration = Date.now() - startTime;

  logger.info('cron:refresh-tokens:complete', {
    duration,
    total: connections.length,
    refreshed,
    skipped,
    transientFailed,
    permanentFailed,
  });

  return NextResponse.json({
    success: true,
    duration,
    total: connections.length,
    refreshed,
    skipped,
    transientFailed,
    permanentFailed,
  });
}
