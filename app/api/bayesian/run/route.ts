/**
 * Bayesian Optimisation Run API
 *
 * POST /api/bayesian/run — Trigger an async maximise optimisation run
 *
 * Enqueues a BullMQ job and creates a BOOptimisationRun record.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - REDIS_URL (CRITICAL — BullMQ)
 * - NEXT_PUBLIC_APP_URL — used as callback URL base
 * - BAYESIAN_SERVICE_URL (optional)
 * - BAYESIAN_SERVICE_API_KEY (optional)
 *
 * @module app/api/bayesian/run/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { isWithinBOLimit } from '@/lib/bayesian/feature-limits';
import { getQueue, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';

const runSchema = z.object({
  spaceId:      z.string().min(1),
  initPoints:   z.number().int().min(3).max(20).optional(),
  nIterations:  z.number().int().min(5).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = runSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { spaceId, initPoints, nIterations } = validation.data;

    // Resolve user org and plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    const userOrgId = user?.organizationId;
    const plan = user?.organization?.plan ?? 'free';

    // Fetch space and verify ownership
    const space = await prisma.bOSpace.findUnique({
      where: { id: spaceId },
      select: { id: true, orgId: true },
    });
    if (!space) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Space not found' },
        { status: 404 },
      );
    }
    if (space.orgId !== userOrgId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied — space belongs to a different organisation' },
        { status: 403 },
      );
    }

    // Feature-limit check: monthly optimisation run count
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRunCount = await prisma.bOOptimisationRun.count({
      where: {
        orgId: space.orgId,
        createdAt: { gte: monthStart },
      },
    });
    if (!isWithinBOLimit(plan, 'monthlyOptimisations', monthlyRunCount)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Monthly optimisation run limit reached' },
        { status: 403 },
      );
    }

    // Enqueue to BullMQ BAYESIAN_OPTIMISATION queue
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/internal/bo-callback`;
    const queue = getQueue(QUEUE_NAMES.BAYESIAN_OPTIMISATION);
    const job = await queue.add('bo:run-optimisation', {
      type: 'bo:run-optimisation' as const,
      spaceId,
      orgId: space.orgId,
      userId,
      initPoints,
      nIterations,
      callbackUrl,
    });

    // Create BOOptimisationRun record
    const run = await prisma.bOOptimisationRun.create({
      data: {
        spaceId,
        orgId:          space.orgId,
        userId,
        externalJobId:  job.id ?? null,
        status:         'running',
        initPoints:     initPoints  ?? 5,
        nIterations:    nIterations ?? 25,
        startedAt:      new Date(),
      },
    });

    return NextResponse.json({ data: { jobId: job.id, runId: run.id } }, { status: 202 });
  } catch (error) {
    logger.error('POST /api/bayesian/run error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to enqueue optimisation run' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
