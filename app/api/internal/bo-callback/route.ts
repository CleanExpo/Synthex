/**
 * Bayesian Optimisation Async Callback — Internal Webhook
 *
 * POST /api/internal/bo-callback
 *
 * Called by the Python BO service on async job completion.
 * Authenticated via X-Service-Key header (service-to-service, not JWT).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - BAYESIAN_SERVICE_API_KEY (CRITICAL — shared secret for this webhook)
 *
 * @module app/api/internal/bo-callback/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const callbackSchema = z.object({
  jobId:           z.string(),
  spaceId:         z.string(),
  status:          z.enum(['completed', 'failed', 'cancelled']),
  bestParameters:  z.record(z.string(), z.number()).nullable(),
  bestTarget:      z.number().nullable(),
  error:           z.string().nullable(),
  iterations:      z.number().int(),
});

export async function POST(request: NextRequest) {
  // Service-to-service auth: verify X-Service-Key header
  const serviceKey = request.headers.get('x-service-key');
  const expectedKey = process.env.BAYESIAN_SERVICE_API_KEY;
  if (!expectedKey || serviceKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorised', message: 'Invalid service key' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = callbackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { jobId, spaceId, status, bestParameters, bestTarget, error, iterations } = validation.data;

    logger.info('BO callback received', { jobId, spaceId, status, iterations });

    // Update BOOptimisationRun
    const run = await prisma.bOOptimisationRun.findFirst({
      where: { externalJobId: jobId },
    });

    if (run) {
      await prisma.bOOptimisationRun.update({
        where: { id: run.id },
        data: {
          status,
          bestParameters: bestParameters ?? undefined,
          bestTarget:     bestTarget     ?? undefined,
          currentIteration: iterations,
          error:          error ?? null,
          completedAt:    new Date(),
        },
      });
    } else {
      logger.warn('BO callback: no run found for jobId', { jobId });
    }

    // On successful completion, update the BOSpace best parameters
    if (status === 'completed' && bestParameters !== null) {
      await prisma.bOSpace.update({
        where: { id: spaceId },
        data: {
          bestParameters,
          bestTarget: bestTarget ?? undefined,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('POST /api/internal/bo-callback error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process callback' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
