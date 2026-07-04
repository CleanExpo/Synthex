/**
 * Spatiotemporal Models API
 *
 * GET /api/predict/models — List all SpatiotemporalModel records for the authenticated org.
 *
 * Plan limits:
 *   free: 0 (no access)
 *   pro:  0 (no access)
 *   growth: 2 models
 *   scale: unlimited
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/predict/models/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { isSpatiotemporalAvailable } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';
import { resolveEffectivePlan } from '@/lib/billing/plan-access';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Resolve the ACTIVE brand for multi-business owners (falls back to the
    // home org, then null) rather than user.organizationId directly — otherwise
    // a brand-switched owner lists the WRONG brand's models. See
    // lib/multi-business/business-scope.
    const orgId = await getEffectiveOrganizationId(userId);
    if (!orgId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'No organisation' },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    const plan = await resolveEffectivePlan(userId, organization?.plan);

    if (!isSpatiotemporalAvailable(plan)) {
      return NextResponse.json(
        { error: 'Upgrade required', upgrade: true },
        { status: 403 }
      );
    }

    const models = await prisma.spatiotemporalModel.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: models });
  } catch (error) {
    logger.error('GET /api/predict/models error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to list spatiotemporal models',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
