/**
 * GET /api/monthly-story/latest
 *
 * Returns the most-recent MonthlyStory for the authenticated org.
 * Used by the dashboard card to check if there is an unread story to show.
 *
 * Response 200:
 *   { story: MonthlyStory | null }
 *
 * Only returns stories that have been delivered (deliveredAt != null)
 * and have not yet been dismissed by this org.
 *
 * @task SYN-553
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ story: null });
  }

  const story = await prisma.monthlyStory.findFirst({
    where: {
      organizationId: user.organizationId,
      deliveredAt: { not: null },
      dismissedAt: null,
    },
    orderBy: { generatedAt: 'desc' },
    select: {
      id: true,
      monthYear: true,
      storyText: true,
      totalReach: true,
      postsPublished: true,
      autonomousPosts: true,
      minutesSaved: true,
      referralClicked: true,
      generatedAt: true,
      deliveredAt: true,
    },
  });

  return NextResponse.json({ story: story ?? null });
}
