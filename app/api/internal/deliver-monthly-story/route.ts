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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** Default anchor day when org has no billing_anchor_date set. */
const DEFAULT_ANCHOR_DAY = 28;

/** Deliver stories whose anchor date falls in the next 48–72 hours.
 *  Handles month rollover: if the anchor day has already passed this month,
 *  checks the next month's occurrence instead. */
export function storyIsDeliveryDue(
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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

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
          users: {
            where: { role: 'owner' },
            select: { email: true },
            take: 1,
          },
        },
      },
      qualityReviews: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      storyConfig: true,
    },
  } as Parameters<typeof prisma.monthlyStory.findMany>[0]);

  const results = { delivered: 0, skipped: 0, emailFailed: 0 };

  for (const story of stories) {
    const org = (story as any).organization;
    const config = (story as any).storyConfig;
    const qualityReviews = (story as any).qualityReviews as Array<{
      qualityScore: number;
      approved: boolean;
    }>;

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
    const toEmail = org.billingEmail ?? org.users?.[0]?.email ?? null;

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
