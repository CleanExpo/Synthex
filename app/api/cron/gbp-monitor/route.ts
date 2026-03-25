/**
 * GBP Monitor Cron
 *
 * GET /api/cron/gbp-monitor
 * Runs daily at 5 AM UTC. Snapshots GBP metrics, fetches new reviews,
 * and generates AI reply suggestions for unreplied reviews.
 *
 * AI suggestions are STORED but NEVER auto-sent (human approval gate).
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET: Vercel cron authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getReviews,
  getInsights,
  starRatingToNumber,
} from '@/lib/google/business-profile';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { markReviewReceived } from '@/lib/reviews/review-request-service';
import { calculateVisibilityScore } from '@/lib/scoring/visibility-score';
import { seedAllOrgsWithoutKeywords } from '@/lib/seo/keyword-seeder';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.info('cron:gbp-monitor:start', {
    timestamp: new Date().toISOString(),
  });

  const locations = await prisma.gBPLocation.findMany({
    select: {
      id: true,
      organizationId: true,
      connectionId: true,
      locationId: true,
      locationName: true,
    },
  });

  let snapshotted = 0;
  let reviewsSynced = 0;
  let failed = 0;

  for (const location of locations) {
    try {
      const connectionId = await findOAuthConnection(
        location.organizationId,
        'googlebusiness'
      );
      if (!connectionId) {
        logger.warn('cron:gbp-monitor:no-connection', {
          locationId: location.id,
        });
        continue;
      }

      // 1. Fetch and snapshot insights
      try {
        const insights = await getInsights(connectionId, location.locationId);

        await prisma.gBPSnapshot.upsert({
          where: {
            organizationId_locationId_date: {
              organizationId: location.organizationId,
              locationId: location.id,
              date: today,
            },
          },
          update: {
            searchViews: insights.searchViews ?? null,
            mapsViews: insights.mapsViews ?? null,
            websiteClicks: insights.websiteClicks ?? null,
            phoneClicks: insights.phoneClicks ?? null,
            directionClicks: insights.directionClicks ?? null,
          },
          create: {
            organizationId: location.organizationId,
            locationId: location.id,
            date: today,
            searchViews: insights.searchViews ?? null,
            mapsViews: insights.mapsViews ?? null,
            websiteClicks: insights.websiteClicks ?? null,
            phoneClicks: insights.phoneClicks ?? null,
            directionClicks: insights.directionClicks ?? null,
          },
        });

        snapshotted++;
      } catch (insightError) {
        logger.warn('cron:gbp-monitor:insights-error', {
          locationId: location.id,
          error:
            insightError instanceof Error
              ? insightError.message
              : String(insightError),
        });
      }

      // 2. Fetch reviews
      try {
        const reviewData = await getReviews(connectionId, location.locationId, {
          pageSize: 50,
        });

        // Update snapshot with review counts
        if (reviewData.averageRating || reviewData.totalReviewCount) {
          await prisma.gBPSnapshot.updateMany({
            where: {
              organizationId: location.organizationId,
              locationId: location.id,
              date: today,
            },
            data: {
              averageRating: reviewData.averageRating ?? null,
              totalReviews: reviewData.totalReviewCount ?? null,
            },
          });
        }

        // Upsert each review
        for (const review of reviewData.reviews) {
          await prisma.gBPReview.upsert({
            where: {
              organizationId_gbpReviewId: {
                organizationId: location.organizationId,
                gbpReviewId: review.name,
              },
            },
            update: {
              rating: starRatingToNumber(review.starRating),
              comment: review.comment ?? null,
              reviewTime: new Date(review.createTime),
              replyText: review.reviewReply?.comment ?? null,
              replyTime: review.reviewReply?.updateTime
                ? new Date(review.reviewReply.updateTime)
                : null,
            },
            create: {
              organizationId: location.organizationId,
              locationId: location.id,
              gbpReviewId: review.name,
              reviewerName: review.reviewer?.displayName ?? null,
              reviewerAvatar: review.reviewer?.profilePhotoUrl ?? null,
              rating: starRatingToNumber(review.starRating),
              comment: review.comment ?? null,
              reviewTime: new Date(review.createTime),
              replyText: review.reviewReply?.comment ?? null,
              replyTime: review.reviewReply?.updateTime
                ? new Date(review.reviewReply.updateTime)
                : null,
            },
          });
          reviewsSynced++;
        }

        // Mark any pending review requests as completed if new reviews arrived
        if (reviewData.reviews.length > 0) {
          await markReviewReceived(location.organizationId, location.id).catch(
            (err: unknown) =>
              logger.warn('cron:gbp-monitor:mark-review-received-error', {
                locationId: location.id,
                error: err instanceof Error ? err.message : String(err),
              })
          );
          // Recalculate visibility score after new reviews
          calculateVisibilityScore(location.organizationId).catch(() => {});
        }
      } catch (reviewError) {
        logger.warn('cron:gbp-monitor:reviews-error', {
          locationId: location.id,
          error:
            reviewError instanceof Error
              ? reviewError.message
              : String(reviewError),
        });
      }
    } catch (error) {
      logger.error('cron:gbp-monitor:location-error', {
        locationId: location.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  // SYN-487: Auto-seed keyword targets for any org that now has a primary GBP
  // location but no keyword targets. Fire-and-forget — never blocks the cron.
  seedAllOrgsWithoutKeywords().catch(err => {
    logger.warn('cron:gbp-monitor:keyword-seed-error', {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const duration = Date.now() - startTime;

  logger.info('cron:gbp-monitor:complete', {
    duration,
    totalLocations: locations.length,
    snapshotted,
    reviewsSynced,
    failed,
  });

  return NextResponse.json({
    success: true,
    duration,
    totalLocations: locations.length,
    snapshotted,
    reviewsSynced,
    failed,
  });
}
