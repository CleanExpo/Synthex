/**
 * Start SEO Experiment
 *
 * POST /api/experiments/experiments/[id]/start
 * Transitions experiment from draft/paused → running
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const StartSchema = z.object({
  baselineScore: z.number().min(0).max(100).optional(),
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
    const body = await request.json().catch(() => ({}));
    const parsed = StartSchema.safeParse(body);
    const baselineScore = parsed.success ? parsed.data.baselineScore : undefined;

    const existing = await prisma.sEOExperiment.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Experiment not found' },
        404
      );
    }

    if (!['draft', 'paused'].includes(existing.status)) {
      return APISecurityChecker.createSecureResponse(
        { error: `Cannot start experiment in status: ${existing.status}` },
        400
      );
    }

    const experiment = await prisma.sEOExperiment.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: existing.startedAt ?? new Date(),
        ...(baselineScore !== undefined ? { baselineScore } : {}),
      },
    });

    logger.info('[experiments] Started experiment', { userId, experimentId: id });

    return APISecurityChecker.createSecureResponse({ experiment });
  } catch (error) {
    logger.error('[experiments] START failed', { error, userId, experimentId: id });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to start experiment' },
      500
    );
  }
}
