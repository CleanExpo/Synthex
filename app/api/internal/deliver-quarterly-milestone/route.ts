/**
 * POST /api/internal/deliver-quarterly-milestone
 *
 * CRON_SECRET-guarded internal route called weekly by the
 * `deliver-quarterly-milestone` Supabase Edge Function.
 *
 * For each active organisation:
 *   1. Check data readiness via `quarterly_review_ready()` RPC — gate: ≥3 of 5 conditions
 *   2. Check this event hasn't been delivered in the last 85 days (quarterly guard)
 *   3. Check the 14-day journey throttle via `should_deliver_journey_event()`
 *   4. Gather stats: posts published in quarter, health score, dollar attribution,
 *      authority score delta
 *   5. Send the Quarterly Milestone Review email via Resend
 *   6. Record delivery in `client_journey_events`
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing.
 *
 * @task SYN-662
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendQuarterlyMilestoneEmail } from '@/lib/email/quarterly-milestone-email';
import {
  shouldDeliverJourneyEvent,
  getQuarterlyReviewReadiness,
  QUARTERLY_REVIEW_THRESHOLD,
  type ClientJourneyEventInsert,
} from '@/lib/journey/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** Guard: do not re-deliver the quarterly review within 85 days. */
const QUARTERLY_GUARD_DAYS = 85;

/** Posts published in last 90 days for the hero metric. */
const QUARTER_DAYS = 90;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getQuarterLabel(date: Date): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
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

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    logger.error('deliver-quarterly-milestone: Supabase admin client unavailable');
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  const now = new Date();
  const quarterStart = new Date(now.getTime() - QUARTER_DAYS * 24 * 60 * 60 * 1000);
  const quarterlyGuardCutoff = new Date(
    now.getTime() - QUARTERLY_GUARD_DAYS * 24 * 60 * 60 * 1000
  );

  // Fetch all active orgs (or single org for testing)
  const orgs = await prisma.organization.findMany({
    where: {
      status: 'active',
      ...(body.organizationId ? { id: body.organizationId } : {}),
    },
    select: {
      id: true,
      name: true,
      billingEmail: true,
      users: {
        where: { role: 'owner' },
        select: { email: true },
        take: 1,
      },
    },
  } as Parameters<typeof prisma.organization.findMany>[0]);

  const results = { delivered: 0, skipped: 0, emailFailed: 0 };

  for (const org of orgs) {
    const orgId = org.id;

    // 1. Data readiness gate — quarterly_review_ready() RPC
    const readinessScore = await getQuarterlyReviewReadiness(supabaseAdmin, orgId);
    if (readinessScore < QUARTERLY_REVIEW_THRESHOLD) {
      results.skipped++;
      continue;
    }

    // 2. Quarterly guard — skip if delivered in last 85 days
    const { data: recentDelivery } = await supabaseAdmin
      .from('client_journey_events')
      .select('id')
      .eq('client_id', orgId)
      .eq('event_type', 'quarterly_milestone_review')
      .gte('delivered_at', quarterlyGuardCutoff.toISOString())
      .limit(1);

    if (recentDelivery && recentDelivery.length > 0) {
      results.skipped++;
      continue;
    }

    // 3. 14-day journey throttle — highest priority event, may still be blocked
    const gateOpen = await shouldDeliverJourneyEvent(
      supabaseAdmin,
      orgId,
      'quarterly_milestone_review'
    );
    if (!gateOpen) {
      results.skipped++;
      continue;
    }

    // 4. Resolve recipient email
    const toEmail =
      (org as any).billingEmail ??
      (org as any).users?.[0]?.email ??
      null;

    if (!toEmail) {
      logger.warn('deliver-quarterly-milestone: no email for org', { orgId });
      results.skipped++;
      continue;
    }

    // 5. Posts published in the last 90 days
    const postsPublished = await prisma.post.count({
      where: {
        status: 'published',
        deletedAt: null,
        campaign: { organizationId: orgId },
        publishedAt: { gte: quarterStart },
      },
    } as Parameters<typeof prisma.post.count>[0]);

    // 6. Latest health score
    const latestHealth = await prisma.clientHealthScore.findFirst({
      where: { organizationId: orgId },
      orderBy: { weekStart: 'desc' },
      select: { overallScore: true },
    } as Parameters<typeof prisma.clientHealthScore.findFirst>[0]);

    // 7. Dollar attribution from latest advisor brief
    const latestAdvisor = await prisma.recommendedAction.findFirst({
      where: { organizationId: orgId },
      orderBy: { weekStart: 'desc' },
      select: { dollarAttribution: true },
    } as Parameters<typeof prisma.recommendedAction.findFirst>[0]);

    // 8. Authority score delta (latest vs previous for month-on-month)
    const authorityScores = await prisma.authorityScore.findMany({
      where: { organizationId: orgId },
      orderBy: { computedAt: 'desc' },
      take: 2,
      select: { score: true },
    } as Parameters<typeof prisma.authorityScore.findMany>[0]);

    const authorityScoreDelta =
      authorityScores.length >= 2
        ? (authorityScores[0] as any).score - (authorityScores[1] as any).score
        : null;

    // 9. Send email
    const emailResult = await sendQuarterlyMilestoneEmail({
      to: toEmail,
      businessName: org.name,
      quarterLabel: getQuarterLabel(now),
      postsPublished,
      healthScore: latestHealth ? (latestHealth as any).overallScore : null,
      dollarAttribution: latestAdvisor ? (latestAdvisor as any).dollarAttribution : null,
      authorityScoreDelta,
      dashboardUrl: `${APP_URL}/dashboard`,
    });

    if (emailResult.success) {
      // 10. Record delivery in client_journey_events
      const journeyEvent: ClientJourneyEventInsert = {
        client_id: orgId,
        event_type: 'quarterly_milestone_review',
        delivered_at: now.toISOString(),
        metadata: {
          readiness_score: readinessScore,
          posts_published: postsPublished,
          health_score: latestHealth ? (latestHealth as any).overallScore : null,
          authority_score_delta: authorityScoreDelta,
          recipient: toEmail,
        },
      };

      const { error: insertError } = await supabaseAdmin
        .from('client_journey_events')
        .insert(journeyEvent);

      if (insertError) {
        logger.warn('deliver-quarterly-milestone: journey event insert failed', {
          orgId,
          error: insertError.message,
        });
      }

      results.delivered++;
      logger.info('deliver-quarterly-milestone: delivered', { orgId, readinessScore });
    } else {
      results.emailFailed++;
      logger.error('deliver-quarterly-milestone: email failed', {
        orgId,
        error: emailResult.error,
      });
    }
  }

  logger.info('deliver-quarterly-milestone: run complete', results);
  return NextResponse.json({ success: true, ...results });
}
