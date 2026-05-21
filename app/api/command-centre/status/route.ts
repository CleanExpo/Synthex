/**
 * Command Centre — Status API
 *
 * GET /api/command-centre/status
 * Returns autopilot status, next run, pipeline health, and active persona.
 *
 * @module app/api/command-centre/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { fetchCloseLoopHealth } from '@/lib/close-loop/health';

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

  const [config, lastRun, activePersona, connectedPlatforms, closeLoopHealth] =
    await Promise.all([
      prisma.autopilotConfig.findUnique({
        where: { organizationId },
        select: {
          enabled: true,
          status: true,
          nextRunAt: true,
          lastRunAt: true,
          enabledPlatforms: true,
          lastErrorMessage: true,
          postsPerDayPerPlatform: true,
          autoApproveThreshold: true,
          minScoreThreshold: true,
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
          postsScheduled: true,
          avgScore: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.persona.findFirst({
        where: { userId, status: 'active' },
        select: { id: true, name: true, tone: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.platformConnection.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
      fetchCloseLoopHealth({ organizationId }).catch(() => null),
    ]);

  // Pipeline health: green/yellow/red
  let pipelineHealth: 'green' | 'yellow' | 'red' = 'green';
  if (!config?.enabled) {
    pipelineHealth = 'yellow';
  } else if (config.status === 'error') {
    pipelineHealth = 'red';
  } else if (lastRun?.status === 'failed') {
    pipelineHealth = 'red';
  }

  if (closeLoopHealth?.overall === 'red') {
    pipelineHealth = 'red';
  } else if (closeLoopHealth?.overall === 'yellow' && pipelineHealth === 'green') {
    pipelineHealth = 'yellow';
  }

  return NextResponse.json({
    autopilot: config ?? {
      enabled: false,
      status: 'idle',
      nextRunAt: null,
      lastRunAt: null,
      enabledPlatforms: [],
    },
    lastRun,
    activePersona,
    connectedPlatforms,
    pipelineHealth,
    closeLoopHealth,
  });
}
