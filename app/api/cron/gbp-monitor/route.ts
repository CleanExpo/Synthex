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
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── SYN-531: Auto-suggest helper ──────────────────────────────────────────────

async function generatePendingSuggestions(): Promise<void> {
  // Find unreplied reviews with no AI suggestion (newest first, max 10 per run)
  const pending = await prisma.gBPReview.findMany({
    where: { replyText: null, aiSuggestion: null },
    orderBy: { reviewTime: 'desc' },
    take: 10,
    include: {
      location: { select: { locationName: true } },
      organization: { select: { name: true, industry: true } },
    },
  });

  if (pending.length === 0) return;

  const ai = getAIProvider();

  // Fetch brand DNA for the unique orgs in this batch
  const orgIds = [...new Set(pending.map(r => r.organizationId))];
  const brandDnaRecords = await prisma.brandDNA.findMany({
    where: { organizationId: { in: orgIds } },
    select: { organizationId: true, brandVoice: true },
  });
  const brandDnaMap = new Map(
    brandDnaRecords.map(b => [
      b.organizationId,
      b.brandVoice as BrandVoice | null,
    ])
  );

  for (const review of pending) {
    try {
      const brandVoice = brandDnaMap.get(review.organizationId) ?? null;
      const prompt = buildAutoReplyPrompt(
        review.rating,
        review.comment,
        review.reviewerName,
        review.location.locationName,
        review.organization.name,
        review.organization.industry,
        brandVoice
      );
      const result = await ai.complete({
        model: ai.models.fast,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 350,
      });
      await prisma.gBPReview.update({
        where: { id: review.id },
        data: {
          aiSuggestion: (result.choices[0]?.message.content ?? '').trim(),
          aiSuggestionAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn('cron:gbp-monitor:suggestion-single-error', {
        reviewId: review.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

interface BrandVoice {
  formality?: number;
  tone?: string;
  samplePhrases?: string[];
}

function buildAutoReplyPrompt(
  rating: number,
  comment: string | null,
  reviewerName: string | null,
  locationName: string,
  orgName?: string | null,
  industry?: string | null,
  brandVoice?: BrandVoice | null
): string {
  const name = reviewerName ? reviewerName.split(' ')[0] : null;
  let sentimentInstruction: string;
  if (rating >= 5) {
    sentimentInstruction =
      'Warm appreciation + reference something specific from the review. Invite them to return.';
  } else if (rating === 4) {
    sentimentInstruction =
      'Express genuine gratitude. Invite them to return or connect further.';
  } else if (rating === 3) {
    sentimentInstruction =
      "Acknowledge their experience. Say you'd love to learn more. Provide a direct contact CTA.";
  } else {
    sentimentInstruction =
      'Show empathy. Frame around resolution, not defence. Invite them to contact you offline.';
  }
  let voiceContext = '';
  if (brandVoice) {
    const level =
      (brandVoice.formality ?? 3) >= 4
        ? 'formal and professional'
        : (brandVoice.formality ?? 3) <= 2
          ? 'conversational and relaxed'
          : 'warm and professional';
    voiceContext = `\nBrand voice: ${level}${brandVoice.tone ? `, ${brandVoice.tone}` : ''}.`;
    if (brandVoice.samplePhrases?.length) {
      voiceContext += ` Match this register (sample: "${brandVoice.samplePhrases.slice(0, 2).join('", "')}").`;
    }
  }
  return `You are writing a Google Business Profile reply on behalf of a business owner.\n\nBusiness: ${orgName || locationName}${industry ? ` (${industry})` : ''}${voiceContext}\nReviewer: ${name ?? 'a customer'}\nRating: ${rating}/5 stars\nReview: ${comment || '(no text provided)'}\n\nInstructions:\n- ${sentimentInstruction}\n- Keep it under 180 words\n- Sound like a real person, not a corporate template\n- Do NOT start with "Thank you for your feedback", "We appreciate your review", or "We take all feedback seriously"\n- Do NOT use emojis or include a signature\n- Use Australian English spelling\n- Address the reviewer by first name if provided\n\nReply (write only the reply text):`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GBP_MONITOR');
  if (!auth.ok) return auth.response;

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

  // SYN-531: Auto-generate AI reply suggestions for new unreplied reviews.
  // Process up to 10 reviews per cron run to stay within function time limits.
  generatePendingSuggestions().catch(err => {
    logger.warn('cron:gbp-monitor:suggestion-gen-error', {
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
