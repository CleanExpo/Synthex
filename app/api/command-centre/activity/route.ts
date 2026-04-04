/**
 * Command Centre — Activity Feed API
 *
 * GET /api/command-centre/activity
 * Paginated AI activity feed joining autopilot runs and recent posts.
 *
 * @module app/api/command-centre/activity/route
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

  const url = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('limit') ?? '20'))
  );
  const cursor = url.searchParams.get('cursor');

  // Fetch recent autopilot runs as activity items
  const runs = await prisma.autopilotRun.findMany({
    where: {
      organizationId,
      ...(cursor ? { startedAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      runType: true,
      status: true,
      postsGenerated: true,
      postsScheduled: true,
      postsDrafted: true,
      postsRejected: true,
      avgScore: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
    },
  });

  // Map to activity feed items
  const items = runs.map(run => ({
    id: run.id,
    type: 'autopilot_run' as const,
    action: getActionLabel(run.runType),
    description: getRunDescription(run),
    status: run.status,
    metadata: {
      runType: run.runType,
      postsGenerated: run.postsGenerated,
      postsScheduled: run.postsScheduled,
      postsDrafted: run.postsDrafted,
      avgScore: run.avgScore,
    },
    timestamp: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
  }));

  const nextCursor =
    runs.length === limit
      ? runs[runs.length - 1]?.startedAt.toISOString()
      : null;

  return NextResponse.json({ items, nextCursor });
}

function getActionLabel(runType: string): string {
  switch (runType) {
    case 'kickstart':
      return 'Generated first-week content';
    case 'daily':
      return 'Daily content batch generated';
    case 'trend_react':
      return 'Trend-reactive content created';
    case 'repurpose':
      return 'Top content repurposed';
    case 'ab_test':
      return 'A/B test content generated';
    default:
      return 'Content generated';
  }
}

function getRunDescription(run: {
  runType: string;
  postsGenerated: number;
  postsScheduled: number;
  postsDrafted: number;
  avgScore: number | null;
}): string {
  const parts = [];
  if (run.postsGenerated > 0) parts.push(`${run.postsGenerated} posts created`);
  if (run.postsScheduled > 0) parts.push(`${run.postsScheduled} scheduled`);
  if (run.postsDrafted > 0) parts.push(`${run.postsDrafted} drafts for review`);
  if (run.avgScore) parts.push(`avg score ${run.avgScore}`);
  return parts.join(' · ') || 'No content produced';
}
