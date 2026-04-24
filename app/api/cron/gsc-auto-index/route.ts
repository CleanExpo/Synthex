/**
 * GSC Auto-Index Cron
 *
 * GET /api/cron/gsc-auto-index
 * Runs daily at 6 AM UTC. Auto-submits new published URLs to the
 * Google Indexing API (200/day quota per property).
 *
 * Finds posts published in the last 24 hours that haven't been submitted.
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET: Vercel cron authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requestIndexing } from '@/lib/google/search-console-oauth';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Maximum URLs to submit per day (Google Indexing API quota) */
const DAILY_QUOTA = 200;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GSC_AUTO_INDEX');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();

  logger.info('cron:gsc-auto-index:start', {
    timestamp: new Date().toISOString(),
  });

  // Find orgs that have GSC properties with indexing scope
  const properties = await prisma.gSCProperty.findMany({
    select: {
      id: true,
      organizationId: true,
      connectionId: true,
      siteUrl: true,
    },
  });

  let submitted = 0;
  let skipped = 0;
  let failed = 0;

  for (const property of properties) {
    try {
      // Find recently published platform posts for this org
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentPosts = await prisma.platformPost.findMany({
        where: {
          connection: {
            organizationId: property.organizationId,
          },
          status: 'published',
          publishedAt: { gte: oneDayAgo },
          deletedAt: null,
        },
        select: {
          id: true,
          metadata: true,
        },
        take: DAILY_QUOTA,
      });

      // Also find org's website URL for submitting
      const org = await prisma.organization.findUnique({
        where: { id: property.organizationId },
        select: { website: true },
      });

      // Submit each post's URL if it has a public URL in metadata
      for (const post of recentPosts) {
        const metadata = post.metadata as Record<string, unknown> | null;
        const publicUrl = metadata?.publicUrl as string | undefined;
        const indexed = metadata?.indexingSubmitted as boolean | undefined;

        if (!publicUrl || indexed) {
          skipped++;
          continue;
        }

        if (submitted >= DAILY_QUOTA) {
          logger.info('cron:gsc-auto-index:quota-reached', { submitted });
          break;
        }

        const connectionId = await findOAuthConnection(
          property.organizationId,
          'searchconsole'
        );

        const result = await requestIndexing(publicUrl, 'URL_UPDATED', {
          connectionId: connectionId ?? undefined,
          organizationId: property.organizationId,
        });

        if (result.success) {
          // Mark as submitted to avoid re-submission
          await prisma.platformPost.update({
            where: { id: post.id },
            data: {
              metadata: {
                ...(metadata ?? {}),
                indexingSubmitted: true,
                indexingSubmittedAt: new Date().toISOString(),
              },
            },
          });
          submitted++;
        } else {
          logger.warn('cron:gsc-auto-index:submit-failed', {
            url: publicUrl,
            error: result.error,
          });
          failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      logger.error('cron:gsc-auto-index:property-error', {
        propertyId: property.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  logger.info('cron:gsc-auto-index:complete', {
    duration,
    properties: properties.length,
    submitted,
    skipped,
    failed,
  });

  return NextResponse.json({
    success: true,
    duration,
    properties: properties.length,
    submitted,
    skipped,
    failed,
  });
}
