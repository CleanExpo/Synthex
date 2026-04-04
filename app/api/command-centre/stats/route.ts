/**
 * Command Centre — Stats Strip API
 *
 * GET /api/command-centre/stats
 * Returns 6 aggregate numbers for the stat strip on the Command Centre.
 *
 * @module app/api/command-centre/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalPostsGenerated,
    postsScheduled,
    postsPendingReview,
    postsPublished30d,
    avgScore,
    connectedPlatforms,
  ] = await Promise.all([
    // Total AI-generated posts (all time)
    prisma.post.count({
      where: {
        campaign: { organizationId },
        deletedAt: null,
      },
    }),
    // Currently scheduled
    prisma.post.count({
      where: {
        campaign: { organizationId },
        status: 'scheduled',
        scheduledAt: { gte: now },
        deletedAt: null,
      },
    }),
    // Pending review (draft autopilot posts)
    prisma.post.count({
      where: {
        campaign: { organizationId },
        status: 'draft',
        deletedAt: null,
      },
    }),
    // Published in last 30 days
    prisma.post.count({
      where: {
        campaign: { organizationId },
        status: 'published',
        publishedAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
    }),
    // Average quality score from runs
    prisma.autopilotRun.aggregate({
      where: { organizationId },
      _avg: { avgScore: true },
    }),
    // Connected platforms
    prisma.platformConnection.count({
      where: { organizationId, isActive: true, deletedAt: null },
    }),
  ]);

  return NextResponse.json({
    totalPostsGenerated,
    postsScheduled,
    postsPendingReview,
    postsPublished30d,
    avgQualityScore: avgScore._avg.avgScore
      ? Math.round(avgScore._avg.avgScore)
      : 0,
    connectedPlatforms,
  });
}
