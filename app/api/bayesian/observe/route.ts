/**
 * Bayesian Optimisation Observe API
 *
 * POST /api/bayesian/observe — Register an observation on a BO space
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (optional)
 * - BAYESIAN_SERVICE_API_KEY (optional)
 *
 * @module app/api/bayesian/observe/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getBayesianClient } from '@/lib/bayesian/client';
import { logger } from '@/lib/logger';

const observeSchema = z.object({
  spaceId: z.string().min(1),
  parameters: z.record(z.string(), z.number()),
  target: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

    const validation = observeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { spaceId, parameters, target, metadata } = validation.data;

    // Resolve user org
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const userOrgId = user?.organizationId;

    // Fetch the space and verify org ownership
    const space = await prisma.bOSpace.findUnique({
      where: { id: spaceId },
      select: { id: true, orgId: true, totalObservations: true },
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

    // Forward to BO service (best-effort)
    const client = await getBayesianClient();
    if (client) {
      try {
        await client.observe(spaceId, { parameters, target, metadata });
      } catch (err) {
        logger.warn('BO service observe call failed — persisting locally only', { spaceId, err });
      }
    }

    // Persist observation to DB
    const observation = await prisma.bOObservation.create({
      data: {
        spaceId,
        parameters,
        target,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });

    // Increment totalObservations on the space
    await prisma.bOSpace.update({
      where: { id: spaceId },
      data: { totalObservations: { increment: 1 } },
    });

    const totalObservations = space.totalObservations + 1;

    return NextResponse.json({
      data: {
        id: observation.id,
        spaceId,
        totalObservations,
      },
    });
  } catch (error) {
    logger.error('POST /api/bayesian/observe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to register observation' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
