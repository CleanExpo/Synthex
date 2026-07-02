/**
 * Analytics Sync Cron
 *
 * GET /api/cron/analytics-sync
 * Runs hourly via Vercel Cron.
 *
 * Pulls latest engagement metrics from connected social platforms
 * and updates the analytics tables for dashboard display.
 *
 * @module app/api/cron/analytics-sync/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createFirstWinNotification } from '@/lib/notifications/createFirstWinNotification';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { ingestConnectionPostMetrics } from '@/lib/analytics/ingest-post-metrics';
import { syncConnectionAudienceDemographics } from '@/lib/analytics/sync-audience-demographics';
import { captureServerException } from '@/lib/observability/sentry-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'ANALYTICS_SYNC');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:analytics-sync:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    // Find all organisations with at least one connected platform
    const orgs = await prisma.organization.findMany({
      where: {
        platformConnections: { some: { isActive: true } },
      },
      select: {
        id: true,
        firstWinDetected: true,
        // Primary user — first member of the org receives the first-win notification
        users: {
          select: { id: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        platformConnections: {
          where: { isActive: true },
          select: {
            id: true,
            platform: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
            profileId: true,
            profileName: true,
          },
        },
      },
    });

    logger.info('cron:analytics-sync:orgs', { count: orgs.length });

    let totalSynced = 0;
    let totalErrors = 0;
    let firstWinsDetected = 0;
    let postsIngested = 0;
    let demographicsSynced = 0;

    for (const org of orgs) {
      for (const conn of org.platformConnections) {
        try {
          // 1. Ingest real per-post engagement metrics for the platforms that
          //    genuinely publish AND expose readable post-level insights today
          //    (Instagram/LinkedIn; Facebook is deferred — its Page insights are
          //    not readable via InstagramService). Other platforms no-op
          //    gracefully. Per-post errors are isolated inside the helper so one
          //    bad post can't break the connection's sync.
          const result = await ingestConnectionPostMetrics(conn);
          postsIngested += result.postsUpdated;
          if (result.postErrors > 0) totalErrors += result.postErrors;

          // 1b. Sync real audience demographics (age/gender/location) into
          //     PlatformConnection.metadata.demographics for the platforms whose
          //     audience-insight API we implement today (Instagram). Other
          //     platforms no-op; accounts that don't expose demographics persist
          //     an honest empty payload. Isolated inside the helper so a failed
          //     fetch can't break the connection's sync.
          try {
            const audience = await syncConnectionAudienceDemographics(conn);
            if (audience.stored && audience.hasData) demographicsSynced++;
          } catch (audErr) {
            // Defensive: the helper resolves on failure, but never let an
            // unexpected throw abort the connection sync.
            logger.warn('cron:analytics-sync:audience-demographics-error', {
              orgId: org.id,
              platform: conn.platform,
              error: audErr instanceof Error ? audErr.message : String(audErr),
            });
          }

          // 2. Record the sync heartbeat — only after a successful pass so
          //    lastSync reflects when metrics were actually refreshed.
          await prisma.platformConnection.update({
            where: { id: conn.id },
            data: { lastSync: new Date() },
          });
          totalSynced++;
        } catch (err) {
          // Connection-level isolation — one platform/connection failing does
          // not abort the rest of the batch.
          logger.error('cron:analytics-sync:platform-error', {
            orgId: org.id,
            platform: conn.platform,
            error: err instanceof Error ? err.message : String(err),
          });
          totalErrors++;
        }
      }

      // ── First Win Detection (SYN-525) ────────────────────────────────────
      // Run after each org's analytics sync — skip if already detected
      if (!org.firstWinDetected) {
        const primaryUserId = org.users[0]?.id;
        if (primaryUserId) {
          try {
            const result = await createFirstWinNotification(
              org.id,
              primaryUserId
            );
            if (result.detected) {
              firstWinsDetected++;
              logger.info('cron:analytics-sync:first-win', {
                orgId: org.id,
                notificationId: result.notificationId,
                metric: result.win?.metric,
                improvementPct: result.win?.improvementPct,
              });
            }
          } catch (err) {
            // Non-fatal — don't fail the whole sync for a detection error
            logger.error('cron:analytics-sync:first-win-error', {
              orgId: org.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:analytics-sync:end', {
      totalSynced,
      totalErrors,
      postsIngested,
      demographicsSynced,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      orgsSynced: orgs.length,
      connectionsSynced: totalSynced,
      postsIngested,
      demographicsSynced,
      errors: totalErrors,
      firstWinsDetected,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('cron:analytics-sync:fatal', { error });
    // Alert on fatal sync failure — a silent death here leaves every org's
    // analytics dashboard stale for hours. DSN-gated no-op; secret-scrubbed.
    captureServerException(error, {
      level: 'error',
      operation: 'cron/analytics-sync',
      tags: { cron: 'analytics-sync' },
    });
    return NextResponse.json(
      { error: 'Analytics sync failed' },
      { status: 500 }
    );
  }
}
