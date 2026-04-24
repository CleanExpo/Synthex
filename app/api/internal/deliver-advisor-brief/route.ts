/**
 * POST /api/internal/deliver-advisor-brief
 *
 * CRON_SECRET-guarded internal route called every Monday at 08:00 AEDT
 * (Sunday 21:00 UTC) by the `deliver-advisor-brief` Supabase Edge Function.
 *
 * For each brief with status='generated':
 *   1. Resolve the organisation owner's email
 *   2. Send the advisor brief email (dollar attribution as hero metric)
 *   3. Update status to 'delivered', set deliveredAt
 *   4. On email failure: log the error, leave status as 'generated' for next run
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing
 *
 * @task SYN-595
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendAdvisorBriefEmail } from '@/lib/email/advisor-brief-email';
import type { AdvisorBriefEmailAction } from '@/lib/email/advisor-brief-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'DELIVER_ADVISOR_BRIEF');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  const briefs = await prisma.recommendedAction.findMany({
    where: {
      status: 'generated',
      ...(body.organizationId ? { organizationId: body.organizationId } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          billingEmail: true,
          users: {
            select: { email: true },
            take: 1,
          },
        },
      },
    },
  });

  const results = { delivered: 0, skipped: 0, emailFailed: 0 };
  const now = new Date();

  for (const brief of briefs) {
    const org = (brief as any).organization as {
      id: string;
      name: string;
      billingEmail: string | null;
      users: Array<{ email: string }>;
    };

    const toEmail = org.billingEmail ?? org.users?.[0]?.email ?? null;
    if (!toEmail) {
      logger.warn('deliver-advisor-brief: no email for org', { orgId: org.id });
      results.skipped++;
      continue;
    }

    const actions =
      (brief.actions as unknown as AdvisorBriefEmailAction[]) ?? [];

    const emailResult = await sendAdvisorBriefEmail({
      to: toEmail,
      businessName: org.name,
      weekLabel: formatWeekLabel(brief.weekStart),
      dollarAttribution: brief.dollarAttribution,
      actions,
      competitorMicroInsight: brief.competitorMicroInsight,
      geoTeaserText: brief.geoTeaserText,
      briefId: brief.id,
    });

    if (emailResult.success) {
      await prisma.recommendedAction.update({
        where: { id: brief.id },
        data: { status: 'delivered', deliveredAt: now },
      });
      results.delivered++;

      logger.info('deliver-advisor-brief: delivered', {
        briefId: brief.id,
        orgId: org.id,
        weekStart: brief.weekStart,
      });
    } else {
      results.emailFailed++;
      logger.error('deliver-advisor-brief: email failed', {
        briefId: brief.id,
        orgId: org.id,
        error: emailResult.error,
      });
    }
  }

  logger.info('deliver-advisor-brief: run complete', results);

  return NextResponse.json({ success: true, ...results });
}
