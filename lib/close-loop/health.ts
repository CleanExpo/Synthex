import { createClient } from '@supabase/supabase-js';

export const CLOSE_LOOP_REQUIRED_PIPELINES = [
  'build-knowledge-graph',
  'ai-advisor',
  'content-profile',
  'content-score',
] as const;

export type CloseLoopPipelineName =
  (typeof CLOSE_LOOP_REQUIRED_PIPELINES)[number];

export interface CloseLoopPipelineSnapshot {
  name: CloseLoopPipelineName;
  lastRunAt: string | null;
  status: 'success' | 'partial' | 'failed' | 'no_data';
  clientsProcessed: number;
  clientsFailed: number;
  durationMs: number | null;
  stale: boolean;
}

export interface CloseLoopHealthReport {
  checkedAt: string;
  overall: 'green' | 'yellow' | 'red';
  pipelines: CloseLoopPipelineSnapshot[];
}

interface EdgeFunctionLogRow {
  function_name: string;
  status: 'success' | 'partial' | 'failed';
  clients_processed: number | null;
  clients_failed: number | null;
  duration_ms: number | null;
  created_at: string;
}

export function evaluateCloseLoopHealth(
  rows: EdgeFunctionLogRow[],
  now = new Date()
): CloseLoopHealthReport {
  const latestByName = new Map<string, EdgeFunctionLogRow>();
  for (const row of rows) {
    if (!latestByName.has(row.function_name)) {
      latestByName.set(row.function_name, row);
    }
  }

  const pipelines = CLOSE_LOOP_REQUIRED_PIPELINES.map((name) => {
    const row = latestByName.get(name);
    if (!row) {
      return {
        name,
        lastRunAt: null,
        status: 'no_data' as const,
        clientsProcessed: 0,
        clientsFailed: 0,
        durationMs: null,
        stale: true,
      };
    }

    const ageMs = now.getTime() - new Date(row.created_at).getTime();
    return {
      name,
      lastRunAt: row.created_at,
      status: row.status,
      clientsProcessed: row.clients_processed ?? 0,
      clientsFailed: row.clients_failed ?? 0,
      durationMs: row.duration_ms,
      stale: ageMs > 7 * 24 * 60 * 60 * 1000,
    };
  });

  const hasRed = pipelines.some(
    (p) => p.status === 'failed' || p.status === 'no_data' || p.stale
  );
  const hasYellow =
    !hasRed &&
    pipelines.some((p) => p.status === 'partial' || p.clientsFailed > 0);

  return {
    checkedAt: now.toISOString(),
    overall: hasRed ? 'red' : hasYellow ? 'yellow' : 'green',
    pipelines,
  };
}

export async function fetchCloseLoopHealth(): Promise<CloseLoopHealthReport> {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('edge_function_logs')
    .select(
      'function_name, status, clients_processed, clients_failed, duration_ms, created_at'
    )
    .in('function_name', [...CLOSE_LOOP_REQUIRED_PIPELINES])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`close-loop health query failed: ${error.message}`);
  }

  return evaluateCloseLoopHealth((data ?? []) as EdgeFunctionLogRow[]);
}
