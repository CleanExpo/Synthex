/**
 * GET  /api/teams/invite-prompt  — Check if the team invite prompt should be shown
 * POST /api/teams/invite-prompt  — Dismiss the team invite prompt
 *
 * Prompt eligibility rules (SYN-597):
 *   - Show if: org age >= 45 days OR has any delivered Monthly Story
 *   - AND: dismissCount < 2
 *   - AND: dismissCount == 0 OR (dismissCount == 1 AND dismissedAt + 14 days <= now)
 *
 * @task SYN-597
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const DAYS_45 = 45 * 24 * 60 * 60 * 1000;
const DAYS_14 = 14 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ shouldShow: false });
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      createdAt: true,
      invitePromptDismissedAt: true,
      invitePromptDismissCount: true,
      monthlyStories: {
        where: { deliveredAt: { not: null } },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!org) return NextResponse.json({ shouldShow: false });

  const now = Date.now();
  const dismissCount = org.invitePromptDismissCount;

  // Hard cap at 2 dismissals
  if (dismissCount >= 2) {
    return NextResponse.json({ shouldShow: false });
  }

  // Reappear logic: if dismissed once, wait 14 days
  if (dismissCount === 1 && org.invitePromptDismissedAt) {
    const dismissedMs = org.invitePromptDismissedAt.getTime();
    if (now - dismissedMs < DAYS_14) {
      return NextResponse.json({ shouldShow: false });
    }
  }

  // Eligibility: 45-day org age OR has delivered Monthly Story
  const orgAgeMs = now - org.createdAt.getTime();
  const hasDeliveredStory = org.monthlyStories.length > 0;
  const isEligible = orgAgeMs >= DAYS_45 || hasDeliveredStory;

  return NextResponse.json({ shouldShow: isEligible });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { invitePromptDismissCount: true },
  });

  const currentCount = org?.invitePromptDismissCount ?? 0;

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      invitePromptDismissedAt: new Date(),
      invitePromptDismissCount: currentCount + 1,
    },
  });

  return NextResponse.json({ dismissed: true });
}
