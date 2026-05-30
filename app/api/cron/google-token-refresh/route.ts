/**
 * Google Data-Platform Token Refresh Cron
 *
 * GET /api/cron/google-token-refresh
 * Runs every 30 minutes via Vercel Cron.
 *
 * WHY THIS EXISTS:
 * The proactive `refresh-tokens` cron only refreshes the 9 social platforms in
 * `lib/social` (SUPPORTED_PLATFORMS). The Google DATA platforms —
 * googleanalytics, searchconsole, googlebusiness, googledrive — use a different
 * OAuth layer (`lib/google/google-auth`), so `refresh-tokens` skips them and
 * their access tokens silently expire and never recover (confirmed in
 * production 2026-05-30). Google access tokens last ~1h, so a 30-min cron with
 * a 60-min refresh window keeps them perpetually valid.
 *
 * It reuses `getOAuthAccessToken()` — the same on-read refresh path the rest of
 * the Google integrations use — so there is no duplicate refresh logic.
 *
 * PERMANENT FAILURE: a connection with no refresh token cannot be refreshed.
 * We disable it (isActive=false), flag requires_reauth in metadata, and notify
 * the user to reconnect. Transient failures are left active and retried next run.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL          PostgreSQL connection (CRITICAL)
 * - CRON_SECRET           Vercel cron authorisation (SECRET)
 * - FIELD_ENCRYPTION_KEY  AES-256 key for token encryption (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOAuthAccessToken } from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Google data platforms that `refresh-tokens` (lib/social) does NOT cover. */
const GOOGLE_DATA_PLATFORMS = [
  'googleanalytics',
  'searchconsole',
  'googlebusiness',
  'googledrive',
] as const;

/** Refresh anything expiring within this window (> the 30-min cron interval). */
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

async function notifyReauthRequired(
  userId: string,
  platform: string,
  profileName: string | null
): Promise<void> {
  try {
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    const account = profileName ? ` (${profileName})` : '';
    await prisma.notification.create({
      data: {
        userId,
        type: 'platform_reauth_required',
        title: `Reconnect your ${label} account`,
        message: `Your ${label}${account} connection has expired and can't be refreshed automatically. Go to Platforms → ${label} and click Reconnect.`,
        data: { platform, profileName: profileName ?? null },
        read: false,
      },
    });
  } catch (error) {
    logger.error('[google-token-refresh] notification failed', {
      userId,
      platform,
      error,
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'GOOGLE_TOKEN_REFRESH');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  const now = new Date();
  const refreshDeadline = new Date(now.getTime() + REFRESH_THRESHOLD_MS);

  // Active Google data connections whose token is expired or expiring soon.
  const connections = await prisma.platformConnection.findMany({
    where: {
      platform: { in: GOOGLE_DATA_PLATFORMS as unknown as string[] },
      isActive: true,
      deletedAt: null,
      expiresAt: { lt: refreshDeadline },
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      profileName: true,
      refreshToken: true,
    },
  });

  logger.info('cron:google-token-refresh:found', { count: connections.length });

  let refreshed = 0;
  let reauthRequired = 0;
  let failed = 0;

  for (const c of connections) {
    // No refresh token → cannot self-heal. Disable + notify.
    if (!c.refreshToken) {
      await prisma.platformConnection.update({
        where: { id: c.id },
        data: {
          isActive: false,
          metadata: {
            authStatus: 'requires_reauth',
            authFailedAt: new Date().toISOString(),
            authFailureReason: 'no_refresh_token',
          },
        },
      });
      await notifyReauthRequired(c.userId, c.platform, c.profileName);
      reauthRequired++;
      continue;
    }

    try {
      // Force a refresh on a wide window — getOAuthAccessToken persists the new
      // access token + expiry to the connection row.
      await getOAuthAccessToken(c.id, { refreshThresholdMs: REFRESH_THRESHOLD_MS });
      refreshed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/no refresh token/i.test(message)) {
        await prisma.platformConnection.update({
          where: { id: c.id },
          data: {
            isActive: false,
            metadata: {
              authStatus: 'requires_reauth',
              authFailedAt: new Date().toISOString(),
              authFailureReason: message,
            },
          },
        });
        await notifyReauthRequired(c.userId, c.platform, c.profileName);
        reauthRequired++;
      } else {
        // Transient (rate limit, 5xx, network) — leave active, retry next run.
        logger.warn('[google-token-refresh] transient refresh failure', {
          id: c.id,
          platform: c.platform,
          error: message,
        });
        failed++;
      }
    }
  }

  const duration = Date.now() - startTime;
  logger.info('cron:google-token-refresh:complete', {
    duration,
    total: connections.length,
    refreshed,
    reauthRequired,
    failed,
  });

  return NextResponse.json({
    success: true,
    duration,
    total: connections.length,
    refreshed,
    reauthRequired,
    failed,
  });
}
