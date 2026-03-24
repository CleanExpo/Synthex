/**
 * Autopilot Stats API
 *
 * GET /api/autopilot/stats — Aggregate stats for the Command Centre
 *
 * Returns: total runs, posts generated, avg score, success rate,
 * posts by status, and last run info.
 *
 * @module app/api/autopilot/stats/route
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

  // Aggregate run stats — all four queries are independent, run in parallel
  const [runAgg, lastRun, config, completedRuns] = await Promise.all([
    prisma.autopilotRun.aggregate({
      where: { organizationId },
      _count: true,
      _sum: {
        postsGenerated: true,
        postsScheduled: true,
        postsDrafted: true,
        postsRejected: true,
      },
      _avg: {
        avgScore: true,
      },
    }),
    prisma.autopilotRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        runType: true,
        status: true,
        postsGenerated: true,
        avgScore: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
      },
    }),
    prisma.autopilotConfig.findUnique({
      where: { organizationId },
      select: {
        enabled: true,
        status: true,
        nextRunAt: true,
        lastRunAt: true,
        enabledPlatforms: true,
      },
    }),
    prisma.autopilotRun.count({
      where: { organizationId, status: 'completed' },
    }),
  ]);

  const totalRuns = runAgg._count;

  return NextResponse.json({
    totalRuns,
    totalPostsGenerated: runAgg._sum.postsGenerated ?? 0,
    totalPostsScheduled: runAgg._sum.postsScheduled ?? 0,
    totalPostsDrafted: runAgg._sum.postsDrafted ?? 0,
    totalPostsRejected: runAgg._sum.postsRejected ?? 0,
    avgScore: runAgg._avg.avgScore ? Math.round(runAgg._avg.avgScore) : 0,
    successRate:
      totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
    lastRun,
    config: config ?? {
      enabled: false,
      status: 'idle',
      nextRunAt: null,
      lastRunAt: null,
      enabledPlatforms: [],
    },
  });
}
