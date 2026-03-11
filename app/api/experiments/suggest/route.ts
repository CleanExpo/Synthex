/**
 * Experiment Suggestions API
 *
 * POST /api/experiments/suggest
 *
 * Returns AI-assisted experiment suggestions for a given URL + metrics.
 * On Growth+ plans, uses BO-optimised sampling weights to influence the
 * priority order within each priority tier.
 *
 * Body:
 *   url      — Target page URL (string)
 *   metrics  — CurrentMetrics object (all fields optional)
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * @module app/api/experiments/suggest/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { suggestExperiments } from '@/lib/experiments/experiment-designer';
import { isSurfaceAvailable } from '@/lib/bayesian/feature-limits';
import { getExperimentSamplingWeights } from '@/lib/bayesian/surfaces/experiment-sampling';
import type { ExperimentSamplingWeights } from '@/lib/bayesian/surfaces/experiment-sampling';

// ─── Validation ───────────────────────────────────────────────────────────────

const SuggestSchema = z.object({
  url: z.string().url('A valid URL is required'),
  metrics: z.object({
    geoScore:        z.number().min(0).max(100).optional(),
    eeaScore:        z.number().min(0).max(100).optional(),
    qualityScore:    z.number().min(0).max(100).optional(),
    title:           z.string().optional(),
    metaDescription: z.string().optional(),
    h1:              z.string().optional(),
    hasSchema:       z.boolean().optional(),
    entityName:      z.string().optional(),
  }).optional().default({}),
});

// ─── POST /api/experiments/suggest ───────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request body' },
        400
      );
    }

    const parsed = SuggestSchema.safeParse(body);
    if (!parsed.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: parsed.error.flatten() },
        400
      );
    }

    const { url, metrics } = parsed.data;

    // ── Resolve orgId and plan for BO gating ──
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    const orgId = userRecord?.organizationId ?? userId;
    const plan  = userRecord?.organization?.plan ?? 'free';

    // ── Fetch BO sampling weights if surface is available on this plan ──
    let samplingWeights: ExperimentSamplingWeights | undefined;
    if (isSurfaceAvailable(plan, 'experiment_sampling')) {
      const boResult  = await getExperimentSamplingWeights(orgId);
      samplingWeights = boResult.weights;
    }

    // ── Generate suggestions (BO-informed ordering when weights are provided) ──
    const suggestions = suggestExperiments(url, metrics, samplingWeights);

    logger.info('[experiments/suggest] Generated suggestions', {
      userId,
      url,
      count: suggestions.length,
      boEnabled: samplingWeights !== undefined,
    });

    return APISecurityChecker.createSecureResponse({
      suggestions,
      count: suggestions.length,
    });
  } catch (error) {
    logger.error('[experiments/suggest] POST failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate suggestions' },
      500
    );
  }
}
