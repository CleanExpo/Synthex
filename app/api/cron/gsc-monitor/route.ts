/**
 * GSC Monitor Cron
 *
 * GET /api/cron/gsc-monitor
 * Runs daily at 4 AM UTC. Snapshots GSC metrics for each connected property.
 * Detects coverage regressions and creates notifications on errors.
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET: Vercel cron authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSearchAnalytics } from '@/lib/google/search-console-oauth';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Authorisation
  const auth = verifyCronRequest(request, 'GSC_MONITOR');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.info('cron:gsc-monitor:start', {
    timestamp: new Date().toISOString(),
  });

  // Find all org connections with GSC properties
  const properties = await prisma.gSCProperty.findMany({
    select: {
      id: true,
      organizationId: true,
      connectionId: true,
      siteUrl: true,
    },
  });

  let snapshotted = 0;
  let failed = 0;
  let alerts = 0;

  for (const property of properties) {
    try {
      // Fetch yesterday's analytics (Google data has 2-day lag)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const dateStr = twoDaysAgo.toISOString().split('T')[0];

      const analytics = await getSearchAnalytics(
        property.siteUrl,
        {
          startDate: dateStr,
          endDate: dateStr,
          dimensions: ['query'],
          rowLimit: 1,
        },
        { connectionId: property.connectionId }
      );

      // Create snapshot
      await prisma.gSCSnapshot.upsert({
        where: {
          organizationId_siteUrl_date: {
            organizationId: property.organizationId,
            siteUrl: property.siteUrl,
            date: twoDaysAgo,
          },
        },
        update: {
          clicks: analytics.totals.clicks,
          impressions: analytics.totals.impressions,
          ctr: analytics.totals.ctr,
          position: analytics.totals.position,
        },
        create: {
          organizationId: property.organizationId,
          siteUrl: property.siteUrl,
          date: twoDaysAgo,
          clicks: analytics.totals.clicks,
          impressions: analytics.totals.impressions,
          ctr: analytics.totals.ctr,
          position: analytics.totals.position,
        },
      });

      snapshotted++;

      // Check for regression: compare with 7 days ago
      const sevenDaysAgo = new Date(twoDaysAgo);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const previousSnapshot = await prisma.gSCSnapshot.findFirst({
        where: {
          organizationId: property.organizationId,
          siteUrl: property.siteUrl,
          date: sevenDaysAgo,
        },
      });

      if (previousSnapshot && analytics.totals.clicks > 0) {
        const clickDrop =
          previousSnapshot.clicks > 0
            ? ((previousSnapshot.clicks - analytics.totals.clicks) /
                previousSnapshot.clicks) *
              100
            : 0;

        // Alert on >50% click drop
        if (clickDrop > 50) {
          // Find the user who owns this org
          const orgUser = await prisma.user.findFirst({
            where: { organizationId: property.organizationId },
            select: { id: true },
          });

          if (orgUser) {
            await prisma.notification.create({
              data: {
                userId: orgUser.id,
                type: 'gsc_regression',
                title: `Search traffic drop detected for ${property.siteUrl}`,
                message: `Clicks dropped ${clickDrop.toFixed(0)}% compared to last week. Check Google Search Console for coverage issues.`,
                data: {
                  siteUrl: property.siteUrl,
                  currentClicks: analytics.totals.clicks,
                  previousClicks: previousSnapshot.clicks,
                  dropPercentage: clickDrop,
                },
                read: false,
              },
            });
            alerts++;
          }
        }
      }
    } catch (error) {
      logger.error('cron:gsc-monitor:property-error', {
        propertyId: property.id,
        siteUrl: property.siteUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  logger.info('cron:gsc-monitor:complete', {
    duration,
    total: properties.length,
    snapshotted,
    failed,
    alerts,
  });

  return NextResponse.json({
    success: true,
    duration,
    total: properties.length,
    snapshotted,
    failed,
    alerts,
  });
}
