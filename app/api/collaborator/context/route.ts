/**
 * GET /api/collaborator/context
 *
 * Returns the context data for the collaborator welcome screen:
 *   - Organisation name + owner name
 *   - Latest authority score (Brand IQ)
 *   - Most recent delivered Monthly Story (summary)
 *   - Next 7 days scheduled posts
 *
 * Also updates team_member.last_active_at so the context screen is only shown once.
 *
 * @task SYN-598
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Find this user's team membership
  const membership = await prisma.teamMember.findFirst({
    where: { userId, role: 'collaborator', acceptedAt: { not: null } },
    select: {
      id: true,
      organizationId: true,
      lastActiveAt: true,
      lastWeeklyActiveFiredAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          users: {
            take: 1,
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: 'No collaborator membership found' }, { status: 403 });
  }

  const orgId = membership.organizationId;
  const isFirstVisit = membership.lastActiveAt === null;
  const now = new Date();

  // Determine if weekly-active GA4 event should fire (once per 7-day window, client-side)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const shouldFireWeeklyActive =
    membership.lastWeeklyActiveFiredAt === null ||
    membership.lastWeeklyActiveFiredAt < sevenDaysAgo;

  // Update last_active_at on every visit, and last_weekly_active_fired_at when due
  await prisma.teamMember.update({
    where: { id: membership.id },
    data: {
      lastActiveAt: now,
      ...(shouldFireWeeklyActive ? { lastWeeklyActiveFiredAt: now } : {}),
    },
  });

  const org = (membership as any).organization as {
    id: string;
    name: string;
    users: Array<{ name: string | null; email: string }>;
  };
  const ownerUser = org.users[0];
  const ownerName = ownerUser?.name ?? ownerUser?.email ?? 'the owner';

  // Authority score (Brand IQ)
  const authorityScore = await prisma.authorityScore.findFirst({
    where: { organizationId: orgId },
    orderBy: { computedAt: 'desc' },
    select: { score: true },
  });

  // Most recent delivered Monthly Story
  const latestStory = await prisma.monthlyStory.findFirst({
    where: { organizationId: orgId, deliveredAt: { not: null } },
    orderBy: { deliveredAt: 'desc' },
    select: { monthYear: true, storyText: true, totalReach: true, postsPublished: true },
  });

  // Next 7 days scheduled posts (reuses `now` from above)
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingPosts = await prisma.publishQueueItem.findMany({
    where: {
      organizationId: orgId,
      scheduledAt: { gte: now, lte: in7Days },
      status: { in: ['pending', 'held'] },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 7,
    select: {
      id: true,
      platform: true,
      scheduledAt: true,
      status: true,
    },
  });

  return NextResponse.json({
    isFirstVisit,
    shouldFireWeeklyActive,
    organizationName: org.name,
    ownerName,
    brandIq: authorityScore?.score ?? null,
    latestStory: latestStory
      ? {
          monthYear: latestStory.monthYear,
          storyText: latestStory.storyText,
          totalReach: latestStory.totalReach,
          postsPublished: latestStory.postsPublished,
        }
      : null,
    upcomingPosts,
  });
}
