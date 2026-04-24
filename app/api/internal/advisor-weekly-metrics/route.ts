/**
 * POST /api/internal/advisor-weekly-metrics
 *
 * CRON_SECRET-guarded internal route called every Monday at 09:00 AEDT
 * (Sunday 22:00 UTC) by the `advisor-weekly-metrics` Supabase Edge Function.
 *
 * 1. Marks feedback as 'skipped' for any delivered brief that has no feedback row
 *    from the prior week (prevents denominator drift in usefulness rate)
 * 2. Computes prior week's advisor metrics (usefulness rate, skip rate, action completion)
 * 3. Posts the metrics summary to Slack (ALERT_SLACK_WEBHOOK_URL)
 *
 * Body (optional): { weekStart?: string }  — target specific week (ISO date, default: last Monday)
 *
 * @task SYN-594
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

function lastMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  // Go back until Monday
  while (d.getUTCDay() !== 1) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

async function sendSlackMetrics(metrics: {
  weekStart: string;
  delivered: number;
  usefulCount: number;
  notUsefulCount: number;
  skippedCount: number;
  actionsCompleted: number;
  actionsTotal: number;
  usefulness: string;
}): Promise<void> {
  const webhookUrl = process.env.ALERT_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const advisorUrl = `${APP_URL}/dashboard/advisor`;
  const completionRate =
    metrics.actionsTotal > 0
      ? `${Math.round((metrics.actionsCompleted / metrics.actionsTotal) * 100)}%`
      : 'n/a';

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*Advisor Brief Weekly Metrics — Week of ${metrics.weekStart}*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Advisor Weekly Metrics* — week of ${metrics.weekStart}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Delivered:*\n${metrics.delivered}` },
            {
              type: 'mrkdwn',
              text: `*Usefulness rate:*\n${metrics.usefulness}`,
            },
            {
              type: 'mrkdwn',
              text: `*Useful / Not useful / Skipped:*\n${metrics.usefulCount} / ${metrics.notUsefulCount} / ${metrics.skippedCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Actions completed:*\n${completionRate} (${metrics.actionsCompleted}/${metrics.actionsTotal})`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View advisor →' },
              url: advisorUrl,
            },
          ],
        },
      ],
    }),
  }).catch(err => {
    logger.error('advisor-weekly-metrics: Slack post failed', {
      error: String(err),
    });
  });
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'ADVISOR_WEEKLY_METRICS');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    weekStart?: string;
  };

  // Target the prior week (last Monday)
  const targetWeek = body.weekStart
    ? new Date(body.weekStart)
    : lastMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const weekEnd = new Date(targetWeek);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // 1. Find all briefs delivered this week with no feedback row → mark skipped
  const deliveredBriefs = await prisma.recommendedAction.findMany({
    where: {
      status: 'delivered',
      weekStart: { gte: targetWeek, lt: weekEnd },
    },
    select: { id: true, organizationId: true, weekStart: true },
  });

  let skippedCount = 0;
  for (const brief of deliveredBriefs) {
    const existing = await prisma.advisorFeedback.findUnique({
      where: {
        advisor_feedback_org_week: {
          organizationId: brief.organizationId,
          weekStart: brief.weekStart,
        },
      },
    });
    if (!existing) {
      await prisma.advisorFeedback.create({
        data: {
          organizationId: brief.organizationId,
          weekStart: brief.weekStart,
          response: 'skipped',
        },
      });
      skippedCount++;
    }
  }

  // 2. Compute metrics for the target week
  const feedback = await prisma.advisorFeedback.findMany({
    where: {
      weekStart: { gte: targetWeek, lt: weekEnd },
    },
  });

  const usefulCount = feedback.filter(f => f.response === 'useful').length;
  const notUsefulCount = feedback.filter(
    f => f.response === 'not_useful'
  ).length;
  const totalFeedback = feedback.length;
  const usefulBase = usefulCount + notUsefulCount;
  const usefulnessRate =
    usefulBase > 0 ? `${Math.round((usefulCount / usefulBase) * 100)}%` : 'n/a';
  void totalFeedback; // used in metrics object below

  // Count completed actions for delivered briefs this week
  const briefs = await prisma.recommendedAction.findMany({
    where: { status: 'delivered', weekStart: { gte: targetWeek, lt: weekEnd } },
    select: { actions: true },
  });

  let actionsTotal = 0;
  let actionsCompleted = 0;
  for (const brief of briefs) {
    const actions =
      (brief.actions as unknown as Array<{ completed_at?: string }>) ?? [];
    actionsTotal += actions.length;
    actionsCompleted += actions.filter(a => Boolean(a.completed_at)).length;
  }

  const weekLabel = targetWeek.toISOString().split('T')[0];
  const metrics = {
    weekStart: weekLabel,
    delivered: deliveredBriefs.length,
    usefulCount,
    notUsefulCount,
    skippedCount: totalFeedback - usefulCount - notUsefulCount,
    actionsCompleted,
    actionsTotal,
    usefulness: usefulnessRate,
  };

  // 3. Post to Slack
  await sendSlackMetrics(metrics);

  logger.info('advisor-weekly-metrics: run complete', {
    autoMarkedSkipped: skippedCount,
    ...metrics,
  });

  return NextResponse.json({
    success: true,
    ...metrics,
    autoMarkedSkipped: skippedCount,
  });
}
