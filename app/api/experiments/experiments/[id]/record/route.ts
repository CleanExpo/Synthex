/**
 * Record Experiment Observation
 *
 * POST /api/experiments/experiments/[id]/record
 * Records a metric reading for either the original or variant.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const RecordSchema = z.object({
  variant: z.enum(['original', 'variant']),
  metricValue: z.number().min(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userId = security.context.userId!;
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = RecordSchema.safeParse(body);

    if (!parsed.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request', details: parsed.error.flatten() },
        400
      );
    }

    const { variant, metricValue } = parsed.data;

    const existing = await prisma.sEOExperiment.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Experiment not found' },
        404
      );
    }

    if (existing.status !== 'running') {
      return APISecurityChecker.createSecureResponse(
        { error: 'Can only record observations on running experiments' },
        400
      );
    }

    const observation = await prisma.experimentObservation.create({
      data: {
        experimentId: id,
        variant,
        metricValue,
      },
    });

    // Update the baseline or variant score on the experiment record
    const updateData =
      variant === 'original'
        ? { baselineScore: metricValue }
        : { variantScore: metricValue };

    await prisma.sEOExperiment.update({
      where: { id },
      data: updateData,
    });

    logger.info('[experiments] Recorded observation', {
      userId,
      experimentId: id,
      variant,
      metricValue,
    });

    return APISecurityChecker.createSecureResponse({ observation }, 201);
  } catch (error) {
    logger.error('[experiments] RECORD failed', { error, userId, experimentId: id });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to record observation' },
      500
    );
  }
}
