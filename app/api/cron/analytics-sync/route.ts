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

    for (const org of orgs) {
      for (const conn of org.platformConnections) {
        try {
          // 1. Ingest real per-post engagement metrics for the platforms that
          //    genuinely publish today (Instagram/Facebook/LinkedIn). Other
          //    platforms no-op gracefully. Per-post errors are isolated inside
          //    the helper so one bad post can't break the connection's sync.
          const result = await ingestConnectionPostMetrics(conn);
          postsIngested += result.postsUpdated;
          if (result.postErrors > 0) totalErrors += result.postErrors;

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
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      orgsSynced: orgs.length,
      connectionsSynced: totalSynced,
      postsIngested,
      errors: totalErrors,
      firstWinsDetected,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('cron:analytics-sync:fatal', { error });
    return NextResponse.json(
      { error: 'Analytics sync failed' },
      { status: 500 }
    );
  }
}
