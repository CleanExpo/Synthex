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
import { createClient } from '@supabase/supabase-js';

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

// ── Supabase service-role client (lazy singleton) ─────────────────────────────

let _svc: ReturnType<typeof createClient> | null = null;

function getSvc() {
  if (!_svc) {
    _svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _svc;
}

// ── Pipeline status query ─────────────────────────────────────────────────────

async function fetchPipelineStatuses(): Promise<PipelineStatus[]> {
  const since = new Date();
  since.setHours(since.getHours() - 48);

  const { data, error } = await (getSvc() as ReturnType<typeof createClient<any>>)
    .from('edge_function_logs')
    .select(
      'function_name, status, clients_processed, clients_failed, duration_ms, created_at'
    )
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`edge_function_logs query failed: ${error.message}`);
  }

  // Deduplicate — retain only the most recent row per function_name
  const latestByName = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    if (!latestByName.has(row.function_name)) {
      latestByName.set(row.function_name, row);
    }
  }

  return KNOWN_PIPELINES.map((name) => {
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
      lastRunAt: row.created_at as string,
      status: row.status as 'success' | 'partial' | 'failed',
      clientsProcessed: (row.clients_processed as number) ?? 0,
      clientsFailed: (row.clients_failed as number) ?? 0,
      durationMs: (row.duration_ms as number) ?? null,
    };
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const pipelines = await fetchPipelineStatuses();

    const hasDown = pipelines.some(
      (p) => p.status === 'failed' || p.status === 'no_data'
    );
    const hasDegraded =
      !hasDown && pipelines.some((p) => p.status === 'partial');

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
