/**
 * Cron: Visibility Push — SYN-477
 *
 * Sends a weekly Monday morning email to each org owner with:
 *   - Current Visibility Score
 *   - Delta vs last week
 *   - Single recommended action based on weakest component
 *
 * Schedule: "0 21 * * 0" (Sunday 9pm UTC = Monday 7am AEST)
 * Auth: CRON_SECRET bearer token
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  sendVisibilityPushEmail,
  type VisibilityComponent,
} from '@/lib/email/visibility-push-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export async function GET(req: NextRequest) {
  const auth = verifyCronRequest(req, 'VISIBILITY_PUSH');
  if (!auth.ok) return auth.response;

  // Find every org that has at least one VisibilityScore
  const orgsWithScores = await prisma.visibilityScore.findMany({
    distinct: ['organizationId'],
    orderBy: { calculatedAt: 'desc' },
    select: { organizationId: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const { organizationId } of orgsWithScores) {
    // Latest score
    const latest = await prisma.visibilityScore.findFirst({
      where: { organizationId },
      orderBy: { calculatedAt: 'desc' },
    });
    if (!latest) {
      skipped++;
      continue;
    }

    // Score from ~7 days ago for delta
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const previous = await prisma.visibilityScore.findFirst({
      where: {
        organizationId,
        calculatedAt: { lte: sevenDaysAgo },
      },
      orderBy: { calculatedAt: 'desc' },
    });
    const delta = previous ? latest.score - previous.score : 0;

    // Find the weakest component → recommended action
    const weakest = pickWeakestComponent(latest);

    // Org details
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (!org) {
      skipped++;
      continue;
    }

    // Org owner — first user linked to this org
    const ownerUser = await prisma.user.findFirst({
      where: { organizationId },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!ownerUser?.email) {
      skipped++;
      continue;
    }

    sendVisibilityPushEmail({
      email: ownerUser.email,
      orgName: org.name,
      score: latest.score,
      delta,
      weakestComponent: weakest,
      dashboardUrl: `${APP_URL}/dashboard`,
    });

    sent++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    total: orgsWithScores.length,
  });
}

/**
 * Pick the component with the most room to improve.
 * Uses raw score vs max to find biggest gap.
 */
function pickWeakestComponent(score: {
  reviewScore: number;
  gbpScore: number;
  contentScore: number;
  rankScore: number;
}): VisibilityComponent {
  const gaps: Array<{ component: VisibilityComponent; gap: number }> = [
    { component: 'reviews', gap: 40 - score.reviewScore },
    { component: 'gbp', gap: 20 - score.gbpScore },
    { component: 'content', gap: 20 - score.contentScore },
    { component: 'rankings', gap: 20 - score.rankScore },
  ];
  gaps.sort((a, b) => b.gap - a.gap);
  return gaps[0].component;
}
