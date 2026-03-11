/**
 * Submissions API — Dashboard Summary (Phase 94)
 *
 * GET /api/submissions — Returns a summary of awards, directories, and
 *   upcoming deadlines for the dashboard.
 *
 * @module app/api/submissions/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import type { SubmissionSummary, UpcomingDeadline, AwardStatus, AwardPriority } from '@/lib/awards/types';

// ─── GET /api/submissions ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    const awardWhere: Record<string, unknown> = { userId };
    const dirWhere:   Record<string, unknown> = { userId };
    if (orgId) { awardWhere.orgId = orgId; dirWhere.orgId = orgId; }

    // Run all queries in parallel
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const [
      totalAwards,
      awardSubmitted,
      awardSuccess,
      totalDirectories,
      directoriesLive,
      upcomingAwards,
    ] = await Promise.all([
      prisma.awardListing.count({ where: awardWhere }),
      prisma.awardListing.count({ where: { ...awardWhere, status: 'submitted' } }),
      prisma.awardListing.count({ where: { ...awardWhere, status: { in: ['won', 'shortlisted'] } } }),
      prisma.directoryListing.count({ where: dirWhere }),
      prisma.directoryListing.count({ where: { ...dirWhere, status: 'live' } }),
      prisma.awardListing.findMany({
        where: {
          ...awardWhere,
          deadline: { gte: new Date(), lte: ninetyDaysFromNow },
          status: { notIn: ['won', 'not-selected'] },
        },
        orderBy: { deadline: 'asc' },
        take: 20,
        select: { id: true, name: true, deadline: true, priority: true, status: true },
      }),
    ]);

    const now = new Date();
    const upcomingDeadlines: UpcomingDeadline[] = upcomingAwards
      .filter((a) => a.deadline !== null)
      .map((a) => {
        const dl = a.deadline as Date;
        const daysUntil = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id:         a.id,
          name:       a.name,
          type:       'award' as const,
          deadline:   dl.toISOString(),
          daysUntil,
          priority:   a.priority as AwardPriority,
          status:     a.status   as AwardStatus,
        };
      });

    const summary: SubmissionSummary = {
      totalAwards,
      awardSubmitted,
      awardSuccess,
      totalDirectories,
      directoriesLive,
      upcomingDeadlines,
    };

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[GET /api/submissions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
