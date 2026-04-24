/**
 * POST /api/internal/generate-monthly-story
 *
 * CRON_SECRET-guarded internal route called by the `generate-monthly-story`
 * Supabase Edge Function on the 1st of each month.
 *
 * For each active organisation with posts published in the previous month:
 *   1. Compute metrics (posts, reach, time saved)
 *   2. Generate a 3–5 paragraph plain-English narrative via Claude claude-sonnet-4-6
 *   3. Upsert into monthly_stories
 *   4. Log a StoryQualityReview record (first 3 stories → manual review gate)
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing
 *
 * @task SYN-553
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateMonthlyNarrative } from '@/lib/ai/story-generator';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

/** 22 minutes saved per post reviewed/approved (industry benchmark). */
const MINUTES_PER_POST = 22;

interface OrgMetrics {
  organizationId: string;
  orgName: string;
  monthYear: string; // e.g. "2026-03"
  monthLabel: string; // e.g. "March 2026"
  postsPublished: number;
  autonomousPosts: number;
  totalReach: number;
  minutesSaved: number;
  topPostId: string | null;
  liveModeT: number;
}

async function computeMetrics(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  org: { name: string; liveModeT: number }
): Promise<Omit<OrgMetrics, 'monthYear' | 'monthLabel'>> {
  // Count published queue items in the period
  const published = await prisma.publishQueueItem.findMany({
    where: {
      organizationId,
      status: 'published',
      publishedAt: { gte: periodStart, lt: periodEnd },
    },
    select: { id: true, publishedAt: true },
  });

  const postsPublished = published.length;
  // Approximate: any post published when org is in live mode is autonomous
  const autonomousPosts = org.liveModeT >= 1 ? postsPublished : 0;
  const minutesSaved = postsPublished * MINUTES_PER_POST;

  // Best-effort reach via PlatformMetrics on PlatformPosts from this org
  // If no metrics yet (new org), defaults to 0
  let totalReach = 0;
  let topPostId: string | null = null;

  try {
    const reachRows = await prisma.$queryRaw<
      Array<{ post_id: string; total_reach: number }>
    >`
      SELECT pm."post_id", SUM(pm."reach") AS total_reach
      FROM "platform_metrics" pm
      JOIN "platform_posts" pp ON pp."id" = pm."post_id"
      JOIN "posts" p ON p."id" = pp."post_id"
      JOIN "campaigns" c ON c."id" = p."campaign_id"
      WHERE c."organization_id" = ${organizationId}
        AND pm."recorded_at" >= ${periodStart}
        AND pm."recorded_at" < ${periodEnd}
      GROUP BY pm."post_id"
      ORDER BY total_reach DESC
      LIMIT 10
    `;

    if (reachRows.length > 0) {
      totalReach = reachRows.reduce((sum, r) => sum + Number(r.total_reach), 0);
      topPostId = reachRows[0].post_id;
    }
  } catch {
    // Metrics join may fail for orgs with no campaign/post data yet — graceful
  }

  return {
    organizationId,
    orgName: org.name,
    postsPublished,
    autonomousPosts,
    totalReach,
    minutesSaved,
    topPostId,
    liveModeT: org.liveModeT,
  };
}

async function processOrg(
  org: {
    id: string;
    name: string;
    liveModeT: number;
    billingAnchorDate: number | null;
  },
  periodStart: Date,
  periodEnd: Date,
  monthYear: string,
  monthLabel: string
): Promise<{ generated: boolean; error?: string }> {
  try {
    // Skip if already generated this month
    const existing = await prisma.monthlyStory.findUnique({
      where: { monthly_story_org_month: { organizationId: org.id, monthYear } },
      select: { id: true },
    });
    if (existing) return { generated: false };

    const rawMetrics = await computeMetrics(org.id, periodStart, periodEnd, {
      name: org.name,
      liveModeT: org.liveModeT,
    });

    // Skip orgs with no activity last month
    if (rawMetrics.postsPublished === 0) return { generated: false };

    const metrics: OrgMetrics = {
      ...rawMetrics,
      monthYear,
      monthLabel,
    };

    const storyText = await generateMonthlyNarrative({
      orgName: metrics.orgName,
      monthLabel: metrics.monthLabel,
      postsPublished: metrics.postsPublished,
      autonomousPosts: metrics.autonomousPosts,
      totalReach: metrics.totalReach,
      minutesSaved: metrics.minutesSaved,
    });

    // Upsert story
    const story = await prisma.monthlyStory.create({
      data: {
        organizationId: org.id,
        monthYear,
        storyText,
        totalReach: metrics.totalReach,
        postsPublished: metrics.postsPublished,
        autonomousPosts: metrics.autonomousPosts,
        minutesSaved: metrics.minutesSaved,
        topPostId: metrics.topPostId,
        emailStatus: 'pending',
      },
    });

    // Quality gate — log a review record (first 3 stories must be manually reviewed)
    const config = await prisma.storyConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        autoApproveFuture: false,
        storiesReviewed: 0,
      },
      update: {},
    });

    if (!config.autoApproveFuture && config.storiesReviewed < 3) {
      await prisma.storyQualityReview.create({
        data: {
          storyId: story.id,
          qualityScore: 0, // Awaiting review
          approved: false,
        },
      });
      // Hold email until reviewed
      await prisma.monthlyStory.update({
        where: { id: story.id },
        data: { emailStatus: 'held_for_review' },
      });
    }

    logger.info('generate-monthly-story: generated story', {
      organizationId: org.id,
      monthYear,
      storyId: story.id,
    });
    return { generated: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('generate-monthly-story: org failed', {
      organizationId: org.id,
      error: message,
    });
    return { generated: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GENERATE_MONTHLY_STORY');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  // Period = previous calendar month
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const monthYear = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthLabel = periodStart.toLocaleString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Fetch target orgs
  const whereClause = body.organizationId
    ? { id: body.organizationId }
    : { billingStatus: 'active' };

  const orgs = await prisma.organization.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      liveModeT: true,
      billingAnchorDate: true,
    },
  });

  const results = {
    generated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [] as string[],
  };

  for (const org of orgs) {
    const outcome = await processOrg(
      org,
      periodStart,
      periodEnd,
      monthYear,
      monthLabel
    );
    if (outcome.error) {
      results.errors++;
      results.errorDetails.push(`${org.id}: ${outcome.error}`);
    } else if (outcome.generated) {
      results.generated++;
    } else {
      results.skipped++;
    }
  }

  logger.info('generate-monthly-story: run complete', {
    monthYear,
    ...results,
  });

  return NextResponse.json({
    success: true,
    monthYear,
    ...results,
  });
}
