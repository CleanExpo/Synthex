/**
 * GET /api/calendar/live-mode-readiness
 *
 * Returns the current live-mode readiness state for the authenticated org.
 * Used by the LiveModeReadinessCard to show shadow-mode progress in real-time.
 *
 * Response:
 *   {
 *     liveModeT: 0 | 1 | 2,
 *     calendarMode: 'shadow' | 'live',
 *     shadowPostsReviewed: number,     // total posts with a review action
 *     approvalRate: number,            // 0-100, approved / total reviewed
 *     consecutivePasses: number,       // streak toward the 5-pass threshold
 *     perpetualReviewer: boolean,
 *     nudgeDismissedAt: Record<string, string> | null,
 *     readyToActivate: boolean,        // true when consecutivePasses >= 5
 *   }
 *
 * @task SYN-552
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
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      calendarMode: true,
      liveModeT: true,
      shadowModeApprovalRate: true,
      consecutiveThresholdPasses: true,
      perpetualReviewer: true,
      nudgeDismissedAt: true,
    },
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404 }
    );
  }

  // Count total reviewed shadow posts from the publish queue
  const [approvedCount, rejectedCount] = await Promise.all([
    prisma.publishQueueItem.count({
      where: {
        organizationId: user.organizationId,
        status: 'approved',
      },
    }),
    prisma.publishQueueItem.count({
      where: {
        organizationId: user.organizationId,
        status: 'rejected',
      },
    }),
  ]);

  const totalReviewed = approvedCount + rejectedCount;
  const approvalRate =
    totalReviewed > 0 ? Math.round((approvedCount / totalReviewed) * 100) : 0;

  return NextResponse.json({
    liveModeT: org.liveModeT,
    calendarMode: org.calendarMode,
    shadowPostsReviewed: totalReviewed,
    approvalRate,
    consecutivePasses: org.consecutiveThresholdPasses,
    perpetualReviewer: org.perpetualReviewer,
    nudgeDismissedAt: org.nudgeDismissedAt ?? null,
    readyToActivate: org.consecutiveThresholdPasses >= 5,
  });
}
