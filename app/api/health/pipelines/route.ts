/**
 * GET /api/health/pipelines
 *
 * Returns the current health status of all Synthex ML/AI pipelines,
 * derived from edge_function_logs (most recent run per pipeline in last 48h).
 *
 * Overall status:
 *   'down'     — any pipeline has status 'failed' OR no run in last 48h
 *   'degraded' — any pipeline has status 'partial'
 *   'healthy'  — all pipelines have status 'success'
 *
 * Auth: withAuth() (any authenticated user)
 * Cache: private, max-age=60
 * SYN-628
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ── Known pipelines ───────────────────────────────────────────────────────────

/** All pipeline function_names that must report healthy for overall='healthy'. */
const KNOWN_PIPELINES = [
  'ai-advisor',
  'health-score',
  'attribution-validation',
  'auto-calendar',
  'seasonal-engine',
  'review-intelligence',
  'build-knowledge-graph',
  'content-profile',
  'content-score',
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PipelineStatus {
  name: string;
  lastRunAt: string | null;
  status: 'success' | 'partial' | 'failed' | 'no_data';
  clientsProcessed: number;
  clientsFailed: number;
  durationMs: number | null;
}

interface PipelinesResponse {
  pipelines: PipelineStatus[];
  overall: 'healthy' | 'degraded' | 'down';
}

// ── Pipeline status query ─────────────────────────────────────────────────────

async function fetchPipelineStatuses(): Promise<PipelineStatus[]> {
  const since = new Date();
  since.setHours(since.getHours() - 48);

  const rows = await prisma.edgeFunctionLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      functionName: true,
      status: true,
      clientsProcessed: true,
      clientsFailed: true,
      durationMs: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Deduplicate — retain only the most recent row per function_name
  const latestByName = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (!latestByName.has(row.functionName)) {
      latestByName.set(row.functionName, row);
    }
  }

  return KNOWN_PIPELINES.map(name => {
    const row = latestByName.get(name);
    if (!row) {
      return {
        name,
        lastRunAt: null,
        status: 'no_data' as const,
        clientsProcessed: 0,
        clientsFailed: 0,
        durationMs: null,
      };
    }
    return {
      name,
      lastRunAt: (row.createdAt as Date).toISOString(),
      status: row.status as 'success' | 'partial' | 'failed',
      clientsProcessed: (row.clientsProcessed as number) ?? 0,
      clientsFailed: (row.clientsFailed as number) ?? 0,
      durationMs: (row.durationMs as number) ?? null,
    };
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const pipelines = await fetchPipelineStatuses();

    const hasDown = pipelines.some(
      p => p.status === 'failed' || p.status === 'no_data'
    );
    const hasDegraded = !hasDown && pipelines.some(p => p.status === 'partial');

    const overall: PipelinesResponse['overall'] = hasDown
      ? 'down'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    return NextResponse.json<PipelinesResponse>(
      { pipelines, overall },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch pipeline health', message },
      { status: 500 }
    );
  }
});
