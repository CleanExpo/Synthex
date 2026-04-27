/**
 * Model Scout Cron — SYN-486
 *
 * Runs weekly (Sunday 11pm UTC). Compares this week's model metrics
 * against the previous 4-week average and flags:
 *   - Cost spike ≥ 20%
 *   - Latency spike ≥ 30%
 *   - Error rate ≥ 5%
 *
 * Logs report to AuditLog. Does not auto-switch models — surfaces signals only.
 * Schedule: "0 23 * * 0" in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const COST_SPIKE_THRESHOLD = 0.2; // 20% increase
const LATENCY_SPIKE_THRESHOLD = 0.3; // 30% increase
const ERROR_RATE_THRESHOLD = 0.05; // 5%

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'MODEL_SCOUT');
  if (!auth.ok) return auth.response;

  const now = new Date();
  // Current week start (Monday)
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  const day = thisWeekStart.getUTCDay();
  thisWeekStart.setUTCDate(
    thisWeekStart.getUTCDate() - (day === 0 ? 6 : day - 1)
  );

  // 4 weeks ago
  const fourWeeksAgo = new Date(thisWeekStart.getTime() - 28 * 86400000);

  // Fetch this week's metrics
  const thisWeek = await prisma.modelMetric.findMany({
    where: { weekStart: { gte: thisWeekStart } },
  });

  // Fetch previous 4 weeks for baseline
  const baseline = await prisma.modelMetric.findMany({
    where: {
      weekStart: { gte: fourWeeksAgo, lt: thisWeekStart },
    },
  });

  const flags: string[] = [];
  let flagCount = 0;

  // Group baseline by modelId + contentType
  const baselineMap = new Map<
    string,
    {
      totalCost: number;
      totalLatency: number;
      totalRequests: number;
      totalErrors: number;
      weeks: number;
    }
  >();

  for (const b of baseline) {
    const key = `${b.modelId}|${b.contentType}`;
    const existing = baselineMap.get(key) ?? {
      totalCost: 0,
      totalLatency: 0,
      totalRequests: 0,
      totalErrors: 0,
      weeks: 0,
    };
    existing.totalCost += b.totalCostUsd;
    existing.totalLatency += b.avgLatencyMs ?? 0;
    existing.totalRequests += b.requestCount;
    existing.totalErrors += b.errorCount;
    existing.weeks += 1;
    baselineMap.set(key, existing);
  }

  for (const metric of thisWeek) {
    const key = `${metric.modelId}|${metric.contentType}`;
    const base = baselineMap.get(key);
    if (!base || base.weeks === 0 || base.totalRequests === 0) continue;

    const avgCostPerRequest = base.totalCost / base.totalRequests;
    const thisCostPerRequest =
      metric.requestCount > 0 ? metric.totalCostUsd / metric.requestCount : 0;
    const avgLatency = base.totalLatency / base.weeks;
    const thisLatency = metric.avgLatencyMs ?? 0;
    const baseErrorRate = base.totalErrors / base.totalRequests;
    const thisErrorRate =
      metric.requestCount > 0 ? metric.errorCount / metric.requestCount : 0;

    if (
      avgCostPerRequest > 0 &&
      (thisCostPerRequest - avgCostPerRequest) / avgCostPerRequest >=
        COST_SPIKE_THRESHOLD
    ) {
      const pct = (
        ((thisCostPerRequest - avgCostPerRequest) / avgCostPerRequest) *
        100
      ).toFixed(1);
      flags.push(
        `COST_SPIKE: ${metric.modelId} (${metric.contentType}) +${pct}% vs 4-week avg ($${thisCostPerRequest.toFixed(4)}/req)`
      );
      flagCount++;
    }

    if (
      avgLatency > 0 &&
      (thisLatency - avgLatency) / avgLatency >= LATENCY_SPIKE_THRESHOLD
    ) {
      const pct = (((thisLatency - avgLatency) / avgLatency) * 100).toFixed(1);
      flags.push(
        `LATENCY_SPIKE: ${metric.modelId} (${metric.contentType}) +${pct}% vs avg (${thisLatency}ms)`
      );
      flagCount++;
    }

    if (
      thisErrorRate >= ERROR_RATE_THRESHOLD &&
      thisErrorRate > baseErrorRate
    ) {
      flags.push(
        `HIGH_ERROR_RATE: ${metric.modelId} (${metric.contentType}) ${(thisErrorRate * 100).toFixed(1)}% errors this week`
      );
      flagCount++;
    }
  }

  // Log to AuditLog
  await prisma.auditLog
    .create({
      data: {
        action: 'model_scout_report',
        resource: 'model_metrics',
        resourceId: 'weekly',
        details: {
          weekStart: thisWeekStart.toISOString(),
          modelsEvaluated: thisWeek.length,
          flagCount,
          flags,
        },
        severity: flagCount > 0 ? 'medium' : 'low',
        category: 'system',
        outcome: 'success',
      },
    })
    .catch((err: unknown) =>
      logger.warn('model-scout: audit log failed', { err })
    );

  logger.info('model-scout:complete', {
    modelsEvaluated: thisWeek.length,
    flagCount,
    flags,
  });

  return NextResponse.json({
    ok: true,
    modelsEvaluated: thisWeek.length,
    flagCount,
    flags,
  });
}
