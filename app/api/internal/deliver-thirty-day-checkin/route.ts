/**
 * POST /api/internal/deliver-thirty-day-checkin
 *
 * CRON_SECRET-guarded internal route called daily by the
 * `deliver-thirty-day-checkin` Supabase Edge Function.
 *
 * Finds organisations whose `created_at` falls in the 28–37 day window
 * (9-day band to tolerate cron delays), checks the journey throttle gate,
 * sends the 30-Day Check-In email via Resend, and records the delivery
 * in the `client_journey_events` table.
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing.
 *
 * @task SYN-661
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendThirtyDayCheckinEmail } from '@/lib/email/thirty-day-checkin-email';
import {
  shouldDeliverJourneyEvent,
  type ClientJourneyEventInsert,
} from '@/lib/journey/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** Estimated minutes saved per published post. Conservative lower-bound. */
const MINUTES_SAVED_PER_POST = 30;

/** Organisations with created_at in this window receive the 30-day check-in. */
const WINDOW_MIN_DAYS = 28;
const WINDOW_MAX_DAYS = 37;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
    logger.error('deliver-thirty-day-checkin: Supabase admin client unavailable');
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  const now = new Date();
  const minCreatedAt = new Date(now.getTime() - WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000);
  const maxCreatedAt = new Date(now.getTime() - WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000);

  // Find candidate orgs in the 28–37 day window
  const orgs = await prisma.organization.findMany({
    where: {
      status: 'active',
      createdAt: { gte: minCreatedAt, lte: maxCreatedAt },
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

    // 1. Skip if thirty_day_check_in was already delivered for this org
    const { data: alreadyDelivered } = await supabaseAdmin
      .from('client_journey_events')
      .select('id')
      .eq('client_id', orgId)
      .eq('event_type', 'thirty_day_check_in')
      .limit(1);

    if (alreadyDelivered && alreadyDelivered.length > 0) {
      results.skipped++;
      continue;
    }

    // 2. Check 14-day journey throttle (excludes monthly_story)
    const gateOpen = await shouldDeliverJourneyEvent(
      supabaseAdmin,
      orgId,
      'thirty_day_check_in'
    );
    if (!gateOpen) {
      results.skipped++;
      continue;
    }

    // 3. Resolve recipient email
    const toEmail =
      (org as any).billingEmail ??
      (org as any).users?.[0]?.email ??
      null;

    if (!toEmail) {
      logger.warn('deliver-thirty-day-checkin: no email for org', { orgId });
      results.skipped++;
      continue;
    }

    // 4. Gather stats: published posts in first 30 days
    const postsPublished = await prisma.post.count({
      where: {
        status: 'published',
        deletedAt: null,
        campaign: { organizationId: orgId },
        publishedAt: { lte: maxCreatedAt },
      },
    } as Parameters<typeof prisma.post.count>[0]);

    // 5. Latest health score (optional)
    const latestHealth = await prisma.clientHealthScore.findFirst({
      where: { organizationId: orgId },
      orderBy: { weekStart: 'desc' },
      select: { overallScore: true },
    } as Parameters<typeof prisma.clientHealthScore.findFirst>[0]);

    const minutesSaved = postsPublished * MINUTES_SAVED_PER_POST;
    const healthScore = latestHealth ? (latestHealth as any).overallScore : null;

    // 6. Send email
    const emailResult = await sendThirtyDayCheckinEmail({
      to: toEmail,
      businessName: org.name,
      postsPublished,
      minutesSaved,
      healthScore,
      dashboardUrl: `${APP_URL}/dashboard`,
    });

    if (emailResult.success) {
      // 7. Record delivery in client_journey_events
      const journeyEvent: ClientJourneyEventInsert = {
        client_id: orgId,
        event_type: 'thirty_day_check_in',
        delivered_at: now.toISOString(),
        metadata: {
          posts_published: postsPublished,
          minutes_saved: minutesSaved,
          health_score: healthScore,
          recipient: toEmail,
        },
      };

      const { error: insertError } = await supabaseAdmin
        .from('client_journey_events')
        .insert(journeyEvent);

      if (insertError) {
        // Log but don't fail the request — email was sent, event recording is best-effort
        logger.warn('deliver-thirty-day-checkin: journey event insert failed', {
          orgId,
          error: insertError.message,
        });
      }

      results.delivered++;
      logger.info('deliver-thirty-day-checkin: delivered', { orgId });
    } else {
      results.emailFailed++;
      logger.error('deliver-thirty-day-checkin: email failed', {
        orgId,
        error: emailResult.error,
      });
    }
  }

  logger.info('deliver-thirty-day-checkin: run complete', results);
  return NextResponse.json({ success: true, ...results });
}
