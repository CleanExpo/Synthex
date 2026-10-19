/**
 * GET /api/admin/model-metrics
 *
 * Returns last 4 weeks of ModelMetric grouped by model + contentType.
 * Admin-only via the shared verifyAdmin gate (x-admin-api-key or admin-role JWT).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden', message: auth.error ?? 'Admin access required' },
      { status: 403 }
    );
  }

  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);

  const metrics = await prisma.modelMetric.findMany({
    where: { weekStart: { gte: fourWeeksAgo } },
    orderBy: [{ weekStart: 'desc' }, { modelId: 'asc' }],
  });

  // Group by model + contentType for summary
  const summary = new Map<
    string,
    {
      modelId: string;
      provider: string;
      contentType: string;
      totalRequests: number;
      totalTokens: number;
      totalCostUsd: number;
      avgLatencyMs: number | null;
      totalErrors: number;
      weeks: typeof metrics;
    }
  >();

  for (const m of metrics) {
    const key = `${m.modelId}|${m.contentType}`;
    const existing = summary.get(key);
    if (existing) {
      existing.totalRequests += m.requestCount;
      existing.totalTokens += m.totalTokens;
      existing.totalCostUsd += m.totalCostUsd;
      existing.totalErrors += m.errorCount;
      existing.weeks.push(m);
    } else {
      summary.set(key, {
        modelId: m.modelId,
        provider: m.provider,
        contentType: m.contentType,
        totalRequests: m.requestCount,
        totalTokens: m.totalTokens,
        totalCostUsd: m.totalCostUsd,
        avgLatencyMs: m.avgLatencyMs,
        totalErrors: m.errorCount,
        weeks: [m],
      });
    }
  }

  return NextResponse.json({
    metrics: Array.from(summary.values()).map(s => ({
      ...s,
      costPerRequest:
        s.totalRequests > 0 ? s.totalCostUsd / s.totalRequests : 0,
      errorRate: s.totalRequests > 0 ? s.totalErrors / s.totalRequests : 0,
    })),
    rawMetrics: metrics,
  });
}
