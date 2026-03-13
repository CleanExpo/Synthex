/**
 * Forecast Training Cron
 *
 * GET /api/cron/forecast-training
 *
 * Weekly cron job (0 3 * * 0) that retrains all ready/pending
 * Prophet forecast models with fresh data.
 *
 * Called by Vercel Cron — authorised via CRON_SECRET.
 *
 * @module app/api/cron/forecast-training/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { getForecastingClient } from '@/lib/forecasting/client';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import { collectTrainingData } from '@/lib/forecasting/collect-training-data';
import { logger } from '@/lib/logger';
import type { ForecastMetric } from '@/lib/forecasting/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    // 1. Verify CRON_SECRET
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const startTime = Date.now();
    logger.info('cron:forecast-training:start', { timestamp: new Date().toISOString() });

    // 2. Get client — skip gracefully if not configured
    const client = getForecastingClient();
    if (!client) {
      return NextResponse.json({
        skipped: true,
        reason: 'Service not configured',
      });
    }

    // 3. Load all models due for retraining
    const models = await prisma.forecastModel.findMany({
      where: { status: { in: ['ready', 'pending'] } },
    });

    const results = {
      retrained: 0,
      skipped: 0,
      failed: 0,
      totalModels: models.length,
    };

    // 4. Retrain each model
    for (const model of models) {
      try {
        const metric = model.metric as ForecastMetric;
        const dataPoints = await collectTrainingData(
          model.orgId,
          metric,
          model.platform ?? undefined,
        );

        // Skip if insufficient data
        const minRequired = FORECAST_METRICS[metric]?.minDataPoints ?? 30;
        if (dataPoints.length < minRequired) {
          results.skipped++;
          continue;
        }

        // Retrain via service
        const result = await client.retrainForecastModel(model.id, { data: dataPoints });

        // Serialise typed objects through JSON to satisfy Prisma's InputJsonValue constraint
        const accuracyJson = result.accuracy
          ? (JSON.parse(JSON.stringify(result.accuracy)) as object)
          : undefined;
        const seasonalityJson = result.seasonality
          ? (JSON.parse(JSON.stringify(result.seasonality)) as object)
          : undefined;

        await prisma.forecastModel.update({
          where: { id: model.id },
          data: {
            status: result.status,
            trainingPoints: dataPoints.length,
            lastTrainedAt: new Date(),
            accuracy: accuracyJson,
            seasonality: seasonalityJson,
          },
        });

        results.retrained++;
      } catch (err) {
        logger.error(`forecast-training cron: failed to retrain model ${model.id}`, { err });

        // QA-AUDIT-2026-03-14 (C7): Retry up to 3 times before marking permanently failed.
        // Increment retryCount and keep status as 'pending' so the next cron run re-attempts.
        const currentRetry = (model as { retryCount?: number }).retryCount ?? 0;
        const maxRetries = 3;

        if (currentRetry < maxRetries) {
          await prisma.forecastModel.update({
            where: { id: model.id },
            data: { retryCount: currentRetry + 1 },
          }).catch((updateErr) => {
            logger.error(`forecast-training cron: failed to increment retryCount for model ${model.id}`, { updateErr });
          });
          logger.warn(`forecast-training cron: model ${model.id} retry ${currentRetry + 1}/${maxRetries} — will re-attempt next run`);
        } else {
          await prisma.forecastModel.update({
            where: { id: model.id },
            data: { status: 'failed' },
          }).catch((updateErr) => {
            logger.error(`forecast-training cron: failed to mark model ${model.id} as failed`, { updateErr });
          });
          logger.error(`forecast-training cron: model ${model.id} permanently failed after ${maxRetries} retries`);
        }

        results.failed++;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('cron:forecast-training:end', { timestamp: new Date().toISOString(), durationMs, ...results });

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    logger.error('GET /api/cron/forecast-training error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Forecast training cron failed' },
      { status: 500 },
    );
  }
}
