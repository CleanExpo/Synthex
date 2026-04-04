/**
 * GET /api/admin/model-metrics
 *
 * Returns last 4 weeks of ModelMetric grouped by model + contentType.
 * Admin-only (requires ADMIN role via APISecurityChecker).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
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
