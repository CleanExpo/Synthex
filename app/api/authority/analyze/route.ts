/**
 * Authority Analysis API — Analyse Content for Authority Signals and Citation Validation
 *
 * POST /api/authority/analyze
 * Body: { content: string, orgId: string, deepValidation?: boolean }
 * Returns: AuthorityAnalysisResult
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - STRIPE_AUTHORITY_ADDON_PRICE_ID (OPTIONAL — required for deepValidation)
 *
 * @module app/api/authority/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyzeAuthority } from '@/lib/authority/authority-analyzer';
import { hasAuthorityAddon } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { isSurfaceAvailable } from '@/lib/bayesian/feature-limits';
import { getAuthorityValidationWeights } from '@/lib/bayesian/surfaces/authority-validation';
import { registerObservationSilently } from '@/lib/bayesian/fallback';

const schema = z.object({
  content: z.string().min(50).max(50000),
  orgId: z.string(),
  deepValidation: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { content, orgId, deepValidation } = parsed.data;

    if (deepValidation) {
      const addonActive = await hasAuthorityAddon(userId);
      if (!addonActive) {
        return NextResponse.json(
          { error: 'Authority Ranking add-on required for deep validation', upgrade: true, addon: 'authority' },
          { status: 403 }
        );
      }
    }

    // Resolve plan for BO surface gating
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, plan: true },
    });
    const orgIdForBO = userRecord?.organizationId ?? userId;
    const plan       = (userRecord?.plan ?? 'free').toLowerCase();

    const validationWeightsResult = isSurfaceAvailable(plan, 'authority_validation')
      ? await getAuthorityValidationWeights(orgIdForBO)
      : undefined;

    const result = await analyzeAuthority(content, {
      userId,
      orgId,
      deepValidation: deepValidation ?? false,
      priorityWeights: validationWeightsResult?.weights,
    });

    // Register BO observation (fire-and-forget)
    if (validationWeightsResult?.source === 'bo') {
      void registerObservationSilently(
        'authority_validation',
        orgIdForBO,
        {
          regulatoryPriority:  validationWeightsResult.weights.regulatoryPriority,
          statisticalPriority: validationWeightsResult.weights.statisticalPriority,
          temporalPriority:    validationWeightsResult.weights.temporalPriority,
          causalPriority:      validationWeightsResult.weights.causalPriority,
          comparativePriority: validationWeightsResult.weights.comparativePriority,
          factualPriority:     validationWeightsResult.weights.factualPriority,
        },
        result.overallScore / 100,
        { claimsFound: result.claimsFound, claimsVerified: result.claimsVerified },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Authority analyze error', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
