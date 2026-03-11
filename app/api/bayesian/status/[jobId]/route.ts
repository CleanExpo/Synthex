/**
 * Bayesian Optimisation Status API
 *
 * GET /api/bayesian/status/[jobId] — Poll job status by jobId
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (optional — DB record authoritative when service down)
 * - BAYESIAN_SERVICE_API_KEY (optional)
 *
 * @module app/api/bayesian/status/[jobId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getBayesianClient } from '@/lib/bayesian/client';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const { jobId } = await params;
    if (!jobId || jobId.trim() === '') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'jobId is required' },
        { status: 400 },
      );
    }

    // Resolve user org
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const userOrgId = user?.organizationId;

    // Fetch run from DB
    const run = await prisma.bOOptimisationRun.findFirst({
      where: { externalJobId: jobId },
      include: { space: { select: { orgId: true } } },
    });
    if (!run) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Job not found' },
        { status: 404 },
      );
    }

    // Verify ownership
    if (run.space.orgId !== userOrgId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied — job belongs to a different organisation' },
        { status: 403 },
      );
    }

    // Attempt to get live status from BO service (DB is authoritative on failure)
    let liveStatus: {
      status?: string;
      currentIteration?: number;
      bestParameters?: Record<string, number> | null;
      bestTarget?: number | null;
      error?: string | null;
    } = {};

    const client = await getBayesianClient();
    if (client) {
      try {
        const jobStatus = await client.getJobStatus(jobId);
        liveStatus = {
          status:           jobStatus.status,
          currentIteration: jobStatus.currentIteration,
          bestParameters:   jobStatus.bestParameters,
          bestTarget:       jobStatus.bestTarget,
          error:            jobStatus.error,
        };
      } catch (err) {
        logger.debug('BO service getJobStatus unavailable — using DB record', { jobId, err });
      }
    }

    return NextResponse.json({
      data: {
        jobId,
        runId:            run.id,
        status:           liveStatus.status           ?? run.status,
        currentIteration: liveStatus.currentIteration ?? run.currentIteration,
        bestParameters:   liveStatus.bestParameters   ?? run.bestParameters,
        bestTarget:       liveStatus.bestTarget       ?? run.bestTarget,
        error:            liveStatus.error            ?? run.error,
        startedAt:        run.startedAt,
        completedAt:      run.completedAt,
      },
    });
  } catch (error) {
    logger.error('GET /api/bayesian/status/[jobId] error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch job status' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
