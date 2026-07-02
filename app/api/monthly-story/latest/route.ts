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
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Resolve the active brand for multi-business owners (falls back to the
  // user's home organisation, then null) rather than the home org directly —
  // otherwise a brand-switched owner reads the WRONG brand's monthly story.
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json({ story: null });
  }

  const story = await prisma.monthlyStory.findFirst({
    where: {
      organizationId,
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
