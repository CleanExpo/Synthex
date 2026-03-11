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
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { isSpatiotemporalAvailable } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'No organisation' },
        { status: 403 },
      );
    }

    const orgId = user.organizationId;
    const plan = (user.organization?.plan ?? 'free').toLowerCase();

    if (!isSpatiotemporalAvailable(plan)) {
      return NextResponse.json(
        { error: 'Upgrade required', upgrade: true },
        { status: 403 },
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
      { error: 'Internal Server Error', message: 'Failed to list spatiotemporal models' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
