/**
 * Forecast Predict API
 *
 * POST /api/forecast/predict  — Generate a time-series forecast from a trained model
 *
 * Plan limits:
 *   free:   blocked
 *   pro:    7-day horizon, 10 forecasts/month
 *   growth: 30-day horizon, 100 forecasts/month
 *   scale:  90-day horizon, unlimited
 *
 * @module app/api/forecast/predict/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getForecastingClient } from '@/lib/forecasting/client';
import { isHorizonAllowed, isWithinForecastLimit } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const predictSchema = z.object({
  modelId: z.string().min(1),
  horizonDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

// ─── POST — Generate prediction ───────────────────────────────────────────────

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

    const { modelId, horizonDays } = validation.data;

    // 1. Resolve org + plan (plan is on Organization, NOT User)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        organization: { select: { plan: true } },
      },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Organisation required to generate a forecast' },
        { status: 403 },
      );
    }
    const orgId = user.organizationId;
    const plan = user.organization?.plan ?? 'free';

    // 2. Horizon check
    if (!isHorizonAllowed(plan, horizonDays)) {
      const requiredPlan = horizonDays <= 30 ? 'Growth' : 'Scale';
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `${horizonDays}-day forecast requires the ${requiredPlan} plan`,
        },
        { status: 403 },
      );
    }

    // 3. Monthly forecast count
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCount = await prisma.forecast.count({
      where: {
        orgId,
        generatedAt: { gte: startOfCurrentMonth },
      },
    });

    // 4. Monthly limit check
    if (!isWithinForecastLimit(plan, 'monthlyForecasts', monthlyCount)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Monthly forecast limit reached. Upgrade your plan to generate more forecasts.`,
        },
        { status: 403 },
      );
    }

    // 5. Load model
    const model = await prisma.forecastModel.findFirst({
      where: { id: modelId, orgId },
    });
    if (!model) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Forecast model not found' },
        { status: 404 },
      );
    }

    // 6. Model readiness check
    if (model.status !== 'ready') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: `Model is not ready (status: ${model.status})`,
        },
        { status: 409 },
      );
    }

    // 7. Get client
    const client = getForecastingClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Forecasting service is not configured' },
        { status: 503 },
      );
    }

    // 8. Generate prediction
    const result = await client.predictForecast(modelId, { horizonDays });

    // 9. Persist forecast record
    const forecast = await prisma.forecast.create({
      data: {
        modelId,
        orgId,
        horizonDays,
        predictions: result.predictions as object,
      },
    });

    // 10. Return result
    return NextResponse.json({
      data: {
        ...result,
        forecastId: forecast.id,
      },
    });
  } catch (error) {
    logger.error('POST /api/forecast/predict error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate forecast' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
