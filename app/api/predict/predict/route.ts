/**
 * Spatiotemporal Predict API
 *
 * POST /api/predict/predict — Generate spatiotemporal predictions from a trained BayesNF model.
 *
 * If no prediction points are provided, auto-builds points from:
 *   - Active platform connections for the org
 *   - Next 7 dates from today (cartesian product with platforms)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (required — 503 if absent)
 * - BAYESIAN_SERVICE_API_KEY (required — 503 if absent)
 *
 * @module app/api/predict/predict/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getForecastingClient } from '@/lib/forecasting/client';
import { isSpatiotemporalAvailable } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const predictSchema = z.object({
  modelId: z.string().min(1),
  points: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  quantiles: z.array(z.number().min(0).max(1)).optional(),
});

// ─── POST — Generate predictions ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = predictSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { modelId, points, quantiles } = validation.data;

    // 2. Org + plan resolve
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Organisation required' },
        { status: 403 },
      );
    }
    const orgId = user.organizationId;
    const plan = (user.organization?.plan ?? 'free').toLowerCase();

    // Plan gate
    if (!isSpatiotemporalAvailable(plan)) {
      return NextResponse.json(
        { error: 'Upgrade required', upgrade: true },
        { status: 403 },
      );
    }

    // 3. Resolve model — must belong to org
    const model = await prisma.spatiotemporalModel.findFirst({
      where: { id: modelId, orgId },
    });
    if (!model) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Model not found' },
        { status: 404 },
      );
    }

    // 4. Model must be ready
    if (model.status !== 'ready') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: `Model is not ready for predictions (status: ${model.status})`,
        },
        { status: 409 },
      );
    }

    // 5. Get client
    const client = getForecastingClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'BayesNF service is not configured' },
        { status: 503 },
      );
    }

    // 6. Auto-build prediction points if not provided
    let predictionPoints = points;
    if (!predictionPoints || predictionPoints.length === 0) {
      const today = new Date();
      const next7Dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i + 1);
        return d.toISOString().slice(0, 10);
      });

      const platforms = await prisma.platformConnection.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { platform: true },
        distinct: ['platform'],
      });

      predictionPoints = platforms.flatMap(({ platform }) =>
        next7Dates.map((date) => ({ platform, date })),
      );
    }

    // 7. Generate predictions
    const result = await client.predictSpatiotemporal(modelId, {
      points: predictionPoints,
      quantiles: quantiles ?? [0.1, 0.9],
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('POST /api/predict/predict error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate predictions' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
