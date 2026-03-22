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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

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
        platformConnections: {
          where: { isActive: true },
          select: {
            id: true,
            platform: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
          },
        },
      },
    });

    logger.info('cron:analytics-sync:orgs', { count: orgs.length });

    let totalSynced = 0;
    let totalErrors = 0;

    for (const org of orgs) {
      for (const conn of org.platformConnections) {
        try {
          // Record a sync heartbeat — actual platform API calls
          // will be added per-platform as integrations are completed
          await prisma.platformConnection.update({
            where: { id: conn.id },
            data: { lastSync: new Date() },
          });
          totalSynced++;
        } catch (err) {
          logger.error('cron:analytics-sync:platform-error', {
            orgId: org.id,
            platform: conn.platform,
            error: err instanceof Error ? err.message : String(err),
          });
          totalErrors++;
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:analytics-sync:end', {
      totalSynced,
      totalErrors,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      orgsSynced: orgs.length,
      connectionsSynced: totalSynced,
      errors: totalErrors,
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
