/**
 * Complete SEO Experiment
 *
 * POST /api/experiments/experiments/[id]/complete
 * Marks experiment as completed and determines the winner.
 *
 * On Growth+ plans, registers a Bayesian Optimisation observation for the
 * experiment_sampling surface using the improvement score as the target.
 * This feeds the BO learning loop so future suggestions are better ordered.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { isSurfaceAvailable } from '@/lib/bayesian/feature-limits';
import { EXPERIMENT_SAMPLING_DEFAULTS } from '@/lib/bayesian/surfaces/experiment-sampling';
import { registerObservationSilently } from '@/lib/bayesian/fallback';

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

    // ── Register BO observation for experiment_sampling (fire-and-forget) ──
    // Only register when improvement data is available — gives BO a real signal.
    if (improvement !== null) {
      // Resolve plan for BO gating (best-effort — fall through if lookup fails)
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true, organization: { select: { plan: true } } },
        });
        const orgId = userRecord?.organizationId ?? userId;
        const plan  = userRecord?.organization?.plan ?? 'free';

        if (isSurfaceAvailable(plan, 'experiment_sampling')) {
          // Use the defaults as the parameter snapshot — the actual weights used
          // at suggestion time are not stored on the experiment record. Using
          // defaults here means BO will have a conservative prior until callers
          // begin storing the weights they used. Safe and non-blocking.
          void registerObservationSilently(
            'experiment_sampling',
            orgId,
            {
              titleTag:         EXPERIMENT_SAMPLING_DEFAULTS.titleTag,
              metaDescription:  EXPERIMENT_SAMPLING_DEFAULTS.metaDescription,
              h1:               EXPERIMENT_SAMPLING_DEFAULTS.h1,
              schema:           EXPERIMENT_SAMPLING_DEFAULTS.schema,
              contentStructure: EXPERIMENT_SAMPLING_DEFAULTS.contentStructure,
              internalLinks:    EXPERIMENT_SAMPLING_DEFAULTS.internalLinks,
            },
            improvement,
            { experimentType: existing.experimentType, winnerVariant: winner },
          );
        }
      } catch {
        // BO observation is best-effort — do not fail the completion response
      }
    }

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
