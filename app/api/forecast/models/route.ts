/**
 * Forecast Models API
 *
 * GET  /api/forecast/models  — List all forecast models for the authenticated org
 * POST /api/forecast/models  — Create / train a new Prophet forecast model
 *
 * Plan limits (from lib/forecasting/feature-limits.ts):
 *   free:   0 models (upgrade gate)
 *   pro:    3 models
 *   growth: 15 models
 *   scale:  unlimited
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (optional — falls back gracefully when absent)
 * - BAYESIAN_SERVICE_API_KEY (optional — paired with BAYESIAN_SERVICE_URL)
 *
 * @module app/api/forecast/models/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getForecastingClient } from '@/lib/forecasting/client';
import { getForecastFeatureLimits, isWithinForecastLimit } from '@/lib/forecasting/feature-limits';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import { collectTrainingData } from '@/lib/forecasting/collect-training-data';
import { logger } from '@/lib/logger';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createModelSchema = z.object({
  metric: z.enum([
    'engagement_rate',
    'impressions',
    'reach',
    'clicks',
    'conversions',
    'geo_score',
    'authority_score',
    'follower_growth',
  ]),
  platform: z
    .enum([
      'instagram',
      'linkedin',
      'twitter',
      'facebook',
      'tiktok',
      'youtube',
      'pinterest',
      'reddit',
      'threads',
    ])
    .optional(),
});

// ─── GET — List models ────────────────────────────────────────────────────────

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
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return NextResponse.json({ data: [] });
    }

    const models = await prisma.forecastModel.findMany({
      where: { orgId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orgId: true,
        metric: true,
        platform: true,
        status: true,
        trainingPoints: true,
        lastTrainedAt: true,
        accuracy: true,
        seasonality: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: models });
  } catch (error) {
    logger.error('GET /api/forecast/models error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list forecast models' },
      { status: 500 },
    );
  }
}

// ─── POST — Create / train model ─────────────────────────────────────────────

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

    const validation = createModelSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { metric, platform } = validation.data;

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
        { error: 'Forbidden', message: 'Organisation required to create a forecast model' },
        { status: 403 },
      );
    }
    const orgId = user.organizationId;
    const plan = user.organization?.plan ?? 'free';

    // 2. Free plan — upgrade gate
    if (getForecastFeatureLimits(plan).forecastModels === 0) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Upgrade to the Pro plan to unlock time-series forecasting',
        },
        { status: 403 },
      );
    }

    // 3. Model count limit
    const count = await prisma.forecastModel.count({ where: { orgId } });
    if (!isWithinForecastLimit(plan, 'forecastModels', count)) {
      const limits = getForecastFeatureLimits(plan);
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Forecast model limit reached (${limits.forecastModels} models on ${plan} plan)`,
        },
        { status: 403 },
      );
    }

    // 5. Collect training data
    const dataPoints = await collectTrainingData(orgId, metric, platform);

    // 6. Minimum data points check
    const minRequired = FORECAST_METRICS[metric].minDataPoints;
    if (dataPoints.length < minRequired) {
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: `Insufficient data: ${dataPoints.length} data points collected, ${minRequired} required for ${metric} forecasting`,
        },
        { status: 422 },
      );
    }

    // 7. Get client — if null, upsert with pending status
    const platformValue: string | null = platform ?? null;
    const client = getForecastingClient();
    if (!client) {
      // Prisma nullable composite unique: use findFirst + create/update
      const existing = await prisma.forecastModel.findFirst({
        where: { orgId, metric, platform: platformValue },
      });
      const model = existing
        ? await prisma.forecastModel.update({
            where: { id: existing.id },
            data: { status: 'pending', trainingPoints: dataPoints.length },
          })
        : await prisma.forecastModel.create({
            data: {
              orgId,
              userId,
              metric,
              platform: platformValue,
              status: 'pending',
              trainingPoints: dataPoints.length,
            },
          });
      return NextResponse.json({ data: model }, { status: 202 });
    }

    // 8. Train model in Prophet service
    const result = await client.trainForecastModel({
      orgId,
      metric,
      platform,
      data: dataPoints,
      holidays: 'AU',
    });

    // 9. Persist to DB — use findFirst + create/update to handle nullable platform
    // (Prisma nullable composite unique requires workaround)
    const existing = await prisma.forecastModel.findFirst({
      where: { orgId, metric, platform: platformValue },
    });
    // Serialise typed objects through JSON to satisfy Prisma's InputJsonValue constraint
    const accuracyJson = result.accuracy
      ? (JSON.parse(JSON.stringify(result.accuracy)) as object)
      : undefined;
    const seasonalityJson = result.seasonality
      ? (JSON.parse(JSON.stringify(result.seasonality)) as object)
      : undefined;

    const model = existing
      ? await prisma.forecastModel.update({
          where: { id: existing.id },
          data: {
            status: result.status,
            trainingPoints: dataPoints.length,
            lastTrainedAt: new Date(),
            accuracy: accuracyJson,
            seasonality: seasonalityJson,
          },
        })
      : await prisma.forecastModel.create({
          data: {
            orgId,
            userId,
            metric,
            platform: platformValue,
            status: result.status,
            trainingPoints: dataPoints.length,
            lastTrainedAt: new Date(),
            accuracy: accuracyJson,
            seasonality: seasonalityJson,
          },
        });

    // 10. Return 201 with model
    return NextResponse.json({ data: model }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/forecast/models error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create forecast model' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
