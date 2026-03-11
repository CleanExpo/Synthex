/**
 * Complete SEO Experiment
 *
 * POST /api/experiments/experiments/[id]/complete
 * Marks experiment as completed and determines the winner.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const CompleteSchema = z.object({
  winnerVariant: z.enum(['original', 'variant', 'inconclusive']).optional(),
  variantScore: z.number().min(0).max(100).optional(),
});

function determineWinner(
  baseline: number | null,
  variant: number | null,
  specified?: string
): string {
  if (specified) return specified;
  if (baseline === null || variant === null) return 'inconclusive';

  const diff = variant - baseline;
  const percentChange = baseline > 0 ? (diff / baseline) * 100 : 0;

  // Require at least 5% improvement to declare a winner
  if (percentChange >= 5) return 'variant';
  if (percentChange <= -5) return 'original';
  return 'inconclusive';
}

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
    const parsed = CompleteSchema.safeParse(body);
    const { winnerVariant: specifiedWinner, variantScore: providedVariantScore } =
      parsed.success ? parsed.data : {};

    const existing = await prisma.sEOExperiment.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Experiment not found' },
        404
      );
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      return APISecurityChecker.createSecureResponse(
        { error: `Experiment is already ${existing.status}` },
        400
      );
    }

    const finalVariantScore =
      providedVariantScore ?? existing.variantScore ?? null;
    const winner = determineWinner(
      existing.baselineScore,
      finalVariantScore,
      specifiedWinner
    );

    let improvement: number | null = null;
    if (existing.baselineScore && finalVariantScore) {
      improvement =
        existing.baselineScore > 0
          ? ((finalVariantScore - existing.baselineScore) /
              existing.baselineScore) *
            100
          : 0;
    }

    const experiment = await prisma.sEOExperiment.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        winnerVariant: winner,
        variantScore: finalVariantScore ?? undefined,
        improvement: improvement ?? undefined,
      },
    });

    logger.info('[experiments] Completed experiment', {
      userId,
      experimentId: id,
      winner,
      improvement,
    });

    return APISecurityChecker.createSecureResponse({
      experiment,
      result: {
        winner,
        baselineScore: existing.baselineScore,
        variantScore: finalVariantScore,
        improvement,
        recommendation:
          winner === 'variant'
            ? 'Apply the variant — it outperformed the original.'
            : winner === 'original'
            ? 'Keep the original — the variant underperformed.'
            : 'Results are inconclusive. Consider running the experiment longer or testing a bolder change.',
      },
    });
  } catch (error) {
    logger.error('[experiments] COMPLETE failed', { error, userId, experimentId: id });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to complete experiment' },
      500
    );
  }
}
