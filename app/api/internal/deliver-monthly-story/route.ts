/**
 * POST /api/internal/deliver-monthly-story
 *
 * CRON_SECRET-guarded internal route called daily by the `deliver-monthly-story`
 * Supabase Edge Function.
 *
 * For each undelivered story whose delivery window opens today (billing_anchor_date - 48h):
 *   1. Check the story passes the quality gate (auto_approve_future OR qualityScore >= 4)
 *   2. Send the monthly story email via Resend
 *   3. Mark the story as delivered and create the in-dashboard card record
 *   4. On email failure: create the dashboard card anyway, schedule a 1h email retry
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing
 *
 * @task SYN-553
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendMonthlyStoryEmail } from '@/lib/email/monthly-story-email';
import type { EnhancedMetrics } from '@/lib/email/monthly-story-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** Default anchor day when org has no billing_anchor_date set. */
const DEFAULT_ANCHOR_DAY = 28;

/** Deliver stories whose anchor date falls in the next 48–72 hours.
 *  Handles month rollover: if the anchor day has already passed this month,
 *  checks the next month's occurrence instead. */
function storyIsDeliveryDue(
  anchorDay: number | null,
  now: Date
): boolean {
  const day = anchorDay ?? DEFAULT_ANCHOR_DAY;

  // Build this month's anchor
  let anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  // If this month's anchor has already passed, use next month's
  if (anchor.getTime() <= now.getTime()) {
    anchor = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day)
    );
  }

  const diffH = (anchor.getTime() - now.getTime()) / (1000 * 60 * 60);
  // Deliver when between 0h and 72h before anchor (cron runs daily, ~24h window)
  return diffH >= 0 && diffH < 72;
}

function buildReferralUrl(storyId: string, orgId: string): string {
  const params = new URLSearchParams({
    utm_source: 'monthly_story',
    utm_medium: 'referral',
    utm_campaign: 'client_advocacy',
    ref: orgId,
    story: storyId,
  });
  return `${APP_URL}/refer?${params.toString()}`;
}

function getMonthLabel(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}

// ── Enhanced metrics computation — SYN-638 ───────────────────────────────────

async function computeEnhancedMetrics(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  orgCreatedAt: Date
): Promise<EnhancedMetrics> {
  const now = periodEnd;

  // Months since joined (approximate — 30-day months)
  const monthsSinceJoined = Math.max(
    0,
    Math.floor(
      (now.getTime() - orgCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
  );

  // Total posts published since joining
  let totalPostsSinceJoined = 0;
  try {
    totalPostsSinceJoined = await prisma.publishQueueItem.count({
      where: { organizationId: orgId, status: 'published' },
    });
  } catch {
    // non-fatal
  }

  // Total reach since joining — sum of reach across all org platform metrics
  let totalReachSinceJoined = 0;
  try {
    const reachResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(pm.reach), 0) AS total
      FROM platform_metrics pm
      INNER JOIN platform_posts pp ON pp.id = pm.post_id
      INNER JOIN platform_connections pc ON pc.id = pp.connection_id
      WHERE pc.organization_id = ${orgId}
        AND pp.deleted_at IS NULL
    `;
    totalReachSinceJoined = Number(reachResult[0]?.total ?? 0);
  } catch {
    // non-fatal
  }

  // Total reviews handled (where a reply was posted)
  let totalReviewsHandled = 0;
  try {
    totalReviewsHandled = await prisma.gBPReview.count({
      where: { organizationId: orgId, replyTime: { not: null } },
    });
  } catch {
    // non-fatal — gbp_reviews may not be available
  }

  // Authority score delta — most recent two scores for org
  let authorityScoreDelta: number | null = null;
  try {
    const scores = await prisma.authorityScore.findMany({
      where: { organizationId: orgId },
      orderBy: { computedAt: 'desc' },
      take: 2,
      select: { score: true },
    });
    if (scores.length === 2) {
      const delta = scores[0].score - scores[1].score;
      authorityScoreDelta = delta > 0 ? delta : null;
    }
  } catch {
    // non-fatal
  }

  // Top-performing post in the period — highest reach
  let topPostContent: string | null = null;
  let topPostReach: number | null = null;
  try {
    const topPostRows = await prisma.$queryRaw<
      { content: string; reach: number }[]
    >`
      SELECT pp.content, pm.reach
      FROM platform_metrics pm
      INNER JOIN platform_posts pp ON pp.id = pm.post_id
      INNER JOIN platform_connections pc ON pc.id = pp.connection_id
      WHERE pc.organization_id = ${orgId}
        AND pp.deleted_at IS NULL
        AND pp.published_at >= ${periodStart}
        AND pp.published_at < ${periodEnd}
      ORDER BY pm.reach DESC
      LIMIT 1
    `;
    if (topPostRows.length > 0) {
      const raw = topPostRows[0];
      topPostContent = raw.content.slice(0, 60);
      topPostReach = Number(raw.reach);
    }
  } catch {
    // non-fatal
  }

  // Monthly reach — sum of reach for posts published in this period
  let monthlyReach = 0;
  try {
    const monthlyResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(pm.reach), 0) AS total
      FROM platform_metrics pm
      INNER JOIN platform_posts pp ON pp.id = pm.post_id
      INNER JOIN platform_connections pc ON pc.id = pp.connection_id
      WHERE pc.organization_id = ${orgId}
        AND pp.deleted_at IS NULL
        AND pp.published_at >= ${periodStart}
        AND pp.published_at < ${periodEnd}
    `;
    monthlyReach = Number(monthlyResult[0]?.total ?? 0);
  } catch {
    // non-fatal — fall back to 0
  }

  return {
    monthsSinceJoined,
    totalPostsSinceJoined,
    totalReachSinceJoined,
    totalReviewsHandled,
    authorityScoreDelta,
    topPostContent,
    topPostReach,
    monthlyReach,
  };
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'DELIVER_MONTHLY_STORY');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  const now = new Date();

  // Fetch undelivered stories (pending or failed with retry due)
  const whereClause = {
    deliveredAt: null,
    emailStatus: { in: ['pending', 'held_for_review', 'retry'] as string[] },
    ...(body.organizationId ? { organizationId: body.organizationId } : {}),
  };

  const stories = await prisma.monthlyStory.findMany({
    where: whereClause,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          billingEmail: true,
          billingAnchorDate: true,
          liveModeT: true,
          createdAt: true,
          // SYN-789: owner email lives on TeamMember.role='owner' (not User.role — that field does not exist).
          // Previous implementation used `users: { where: { role: 'owner' } }` with an `as any` cast which
          // silently bypassed the type error; Prisma at runtime either threw or matched incorrectly.
          teamMembers: {
            where: { role: 'owner' },
            select: { user: { select: { email: true } } },
            take: 1,
          },
          // SYN-789: StoryConfig is a 1-to-1 relation on Organization, not on MonthlyStory.
          // Previous implementation put `storyConfig: true` at the MonthlyStory include level with an
          // `as any` cast — at runtime `story.storyConfig` was always undefined, so `autoApproveFuture`
          // was always effectively false and the quality gate could never auto-pass.
          storyConfig: {
            select: { autoApproveFuture: true, storiesReviewed: true },
          },
        },
      },
      qualityReviews: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const results = { delivered: 0, skipped: 0, emailFailed: 0 };

  for (const story of stories) {
    const { organization: org, qualityReviews } = story;
    const config = org.storyConfig;

    // Check quality gate
    const autoApproved = config?.autoApproveFuture ?? false;
    const latestReview = qualityReviews[0];
    const qualityPassed =
      autoApproved ||
      (latestReview && latestReview.qualityScore >= 4 && latestReview.approved);

    // For held_for_review: only deliver if quality gate passed
    if (story.emailStatus === 'held_for_review' && !qualityPassed) {
      results.skipped++;
      continue;
    }

    // Check delivery timing
    if (!storyIsDeliveryDue(org.billingAnchorDate, now)) {
      results.skipped++;
      continue;
    }

    // Resolve recipient email — billing email or owner email
    const toEmail =
      org.billingEmail ?? org.teamMembers?.[0]?.user?.email ?? null;

    if (!toEmail) {
      logger.warn('deliver-monthly-story: no email for org', { orgId: org.id });
      results.skipped++;
      continue;
    }

    // Determine referral eligibility
    const monthsSubscribed = 1; // placeholder — can be computed from billingAnchorDate later
    const includeReferral = org.liveModeT >= 1 && monthsSubscribed >= 1;
    const referralUrl = includeReferral
      ? buildReferralUrl(story.id, org.id)
      : undefined;

    // Compute enhanced metrics for progress arc — SYN-638
    let enhancedMetrics: EnhancedMetrics | undefined;
    try {
      const [storyYear, storyMonth] = story.monthYear.split('-').map(Number);
      const periodStart = new Date(Date.UTC(storyYear, storyMonth - 1, 1));
      const periodEnd = new Date(Date.UTC(storyYear, storyMonth, 1));
      enhancedMetrics = await computeEnhancedMetrics(
        org.id,
        periodStart,
        periodEnd,
        org.createdAt
      );
    } catch (err) {
      logger.warn('deliver-monthly-story: enhanced metrics failed', {
        orgId: org.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Send email
    const emailResult = await sendMonthlyStoryEmail({
      to: toEmail,
      businessName: org.name,
      monthLabel: getMonthLabel(story.monthYear),
      storyText: story.storyText,
      totalReach: story.totalReach,
      postsPublished: story.postsPublished,
      autonomousPosts: story.autonomousPosts,
      minutesSaved: story.minutesSaved,
      includeReferral,
      referralUrl,
      storyId: story.id,
      enhancedMetrics,
      // SYN-729 section 3: surfaced on Resend tags so the email.opened
      // webhook can fire CVML view back to the right org + story.
      orgId: org.id,
      monthYear: story.monthYear,
    });

    if (emailResult.success) {
      await prisma.monthlyStory.update({
        where: { id: story.id },
        data: {
          deliveredAt: now,
          emailStatus: 'sent',
        },
      });
      results.delivered++;

      // Increment storiesReviewed for quality gate progress
      if (!autoApproved && config) {
        const newCount = (config.storiesReviewed ?? 0) + 1;
        await prisma.storyConfig.update({
          where: { organizationId: org.id },
          data: {
            storiesReviewed: newCount,
            // Unlock auto-approve once 3 stories have been reviewed and approved
            ...(newCount >= 3 ? { autoApproveFuture: true } : {}),
          },
        });
      }

      logger.info('deliver-monthly-story: delivered', {
        storyId: story.id,
        orgId: org.id,
        monthYear: story.monthYear,
      });
    } else {
      // Email failed — keep dashboard card visible, schedule retry
      const retryAt = new Date(now.getTime() + 60 * 60 * 1000); // 1h
      await prisma.monthlyStory.update({
        where: { id: story.id },
        data: {
          emailStatus: 'retry',
          emailRetryAt: retryAt,
          emailError: emailResult.error ?? 'Unknown error',
          // Dashboard card: deliveredAt null means card not shown yet
        },
      });
      results.emailFailed++;

      logger.error('deliver-monthly-story: email failed', {
        storyId: story.id,
        orgId: org.id,
        error: emailResult.error,
      });
    }
  }

  logger.info('deliver-monthly-story: run complete', results);

  return NextResponse.json({ success: true, ...results });
}
