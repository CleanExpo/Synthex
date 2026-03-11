/**
 * Spatiotemporal Train API
 *
 * POST /api/predict/train — Collect cross-platform engagement data and train a BayesNF model.
 *
 * Plan limits (from lib/forecasting/feature-limits.ts):
 *   free/pro: no access
 *   growth:   up to 2 spatiotemporal models
 *   scale:    unlimited
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (optional — graceful fallback when absent)
 * - BAYESIAN_SERVICE_API_KEY (optional — paired with BAYESIAN_SERVICE_URL)
 *
 * @module app/api/predict/train/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getForecastingClient } from '@/lib/forecasting/client';
import { isSpatiotemporalAvailable, isWithinForecastLimit } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const trainSchema = z.object({
  name: z.string().min(1).max(100).optional().default('cross_platform_engagement'),
  targetMetric: z.enum(['engagement_rate', 'impressions', 'reach', 'clicks', 'conversions']),
  config: z.object({
    numIterations: z.number().int().min(100).max(2000).optional(),
    learningRate: z.number().min(0.0001).max(0.1).optional(),
    numParticles: z.number().int().min(10).max(100).optional(),
  }).optional(),
});

// ─── Training Data Collector ──────────────────────────────────────────────────

async function collectSpatiotemporalData(
  orgId: string,
  targetMetric: string,
): Promise<Array<Record<string, string | number>>> {
  const connections = await prisma.platformConnection.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, platform: true },
  });
  if (connections.length === 0) return [];

  const results: Array<Record<string, string | number>> = [];

  for (const conn of connections) {
    const posts = await prisma.platformPost.findMany({
      where: { connectionId: conn.id, status: 'published', publishedAt: { not: null } },
      select: { id: true },
    });
    if (posts.length === 0) continue;

    const metrics = await prisma.platformMetrics.findMany({
      where: { postId: { in: posts.map((p) => p.id) } },
      select: {
        engagementRate: true,
        impressions: true,
        reach: true,
        clicks: true,
        saves: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: 'asc' },
    });

    const byDate: Record<string, { sum: number; count: number }> = {};
    for (const m of metrics) {
      const date = m.recordedAt.toISOString().slice(0, 10);
      const fieldMap: Record<string, number | null> = {
        engagement_rate: m.engagementRate,
        impressions: m.impressions,
        reach: m.reach,
        clicks: m.clicks,
        conversions: m.saves, // proxy
      };
      const value = fieldMap[targetMetric];
      if (value === null || value === undefined) continue;
      if (!byDate[date]) byDate[date] = { sum: 0, count: 0 };
      byDate[date].sum += value;
      byDate[date].count += 1;
    }

    for (const [date, { sum, count }] of Object.entries(byDate)) {
      results.push({ platform: conn.platform, date, [targetMetric]: sum / count });
    }
  }

  return results;
}

// ─── POST — Train model ───────────────────────────────────────────────────────

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

    const validation = trainSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { name, targetMetric, config } = validation.data;

    // 2. Org + plan resolve (plan is on Organisation, NOT User)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Organisation required to train a model' },
        { status: 403 },
      );
    }
    const orgId = user.organizationId;
    const plan = (user.organization?.plan ?? 'free').toLowerCase();

    // 3. Plan gate
    if (!isSpatiotemporalAvailable(plan)) {
      return NextResponse.json(
        {
          error: 'Upgrade required',
          message: 'Upgrade to Growth or Scale to unlock BayesNF spatiotemporal models',
          upgrade: true,
        },
        { status: 403 },
      );
    }

    // 4. Model count limit
    const count = await prisma.spatiotemporalModel.count({ where: { orgId } });
    if (!isWithinForecastLimit(plan, 'spatiotemporalModels', count)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Spatiotemporal model limit reached for ${plan} plan`,
        },
        { status: 403 },
      );
    }

    // 5. Collect training data
    const dataPoints = await collectSpatiotemporalData(orgId, targetMetric);

    // 6. Minimum data check
    if (dataPoints.length < 14) {
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: 'Need at least 14 cross-platform data points to train a BayesNF model',
        },
        { status: 422 },
      );
    }

    // 7. Get client — if null, upsert with pending status and return 202
    const client = getForecastingClient();
    if (!client) {
      const model = await prisma.spatiotemporalModel.upsert({
        where: { orgId_name: { orgId, name } },
        create: {
          orgId,
          userId,
          name,
          targetMetric,
          dimensions: { spatial: ['platform'], temporal: ['date'] },
          status: 'pending',
          trainingPoints: dataPoints.length,
          lastTrainedAt: new Date(),
          accuracy: {},
          config: config ?? {},
        },
        update: {
          status: 'pending',
          trainingPoints: dataPoints.length,
          lastTrainedAt: new Date(),
          config: config ?? {},
        },
      });
      return NextResponse.json({ data: model }, { status: 202 });
    }

    // 8. Train via BayesNF service
    const result = await client.trainSpatiotemporalModel({
      orgId,
      name,
      targetMetric,
      dimensions: { spatial: ['platform'], temporal: ['date'] },
      data: dataPoints,
      config,
    });

    // 9. Upsert to DB using @@unique([orgId, name])
    const accuracyJson = result.accuracy
      ? (JSON.parse(JSON.stringify(result.accuracy)) as object)
      : {};
    const configJson = config ? (JSON.parse(JSON.stringify(config)) as object) : {};

    const model = await prisma.spatiotemporalModel.upsert({
      where: { orgId_name: { orgId, name } },
      create: {
        orgId,
        userId,
        name,
        targetMetric,
        dimensions: { spatial: ['platform'], temporal: ['date'] },
        status: result.status,
        trainingPoints: result.trainingPoints ?? dataPoints.length,
        lastTrainedAt: result.lastTrainedAt ? new Date(result.lastTrainedAt) : new Date(),
        accuracy: accuracyJson,
        config: configJson,
      },
      update: {
        status: result.status,
        trainingPoints: result.trainingPoints ?? dataPoints.length,
        lastTrainedAt: result.lastTrainedAt ? new Date(result.lastTrainedAt) : new Date(),
        accuracy: accuracyJson,
        config: configJson,
      },
    });

    // 10. Return 201
    return NextResponse.json({ data: model }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/predict/train error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to train spatiotemporal model' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
