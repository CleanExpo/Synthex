import prisma from '@/lib/prisma';

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

export interface CloseLoopLearningSnapshot {
  name: 'marketing-agency-outcomes';
  lastObservedAt: string | null;
  status: 'active' | 'stale' | 'no_data';
  eventsObserved: number;
  latestEventType: string | null;
  stale: boolean;
}

export interface CloseLoopHealthReport {
  checkedAt: string;
  overall: 'green' | 'yellow' | 'red';
  pipelines: CloseLoopPipelineSnapshot[];
  learningSignals: CloseLoopLearningSnapshot[];
}

interface EdgeFunctionLogRow {
  function_name: string;
  status: 'success' | 'partial' | 'failed';
  clients_processed: number | null;
  clients_failed: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface MarketingAgencyOutcomeRow {
  eventType: string;
  recordedAt: Date;
}

export function evaluateMarketingAgencyOutcomeLearning(
  rows: MarketingAgencyOutcomeRow[],
  now = new Date()
): CloseLoopLearningSnapshot {
  const latest = rows[0] ?? null;
  const stale = latest
    ? now.getTime() - latest.recordedAt.getTime() > 14 * 24 * 60 * 60 * 1000
    : true;

  return {
    name: 'marketing-agency-outcomes',
    lastObservedAt: latest?.recordedAt.toISOString() ?? null,
    status: !latest ? 'no_data' : stale ? 'stale' : 'active',
    eventsObserved: rows.length,
    latestEventType: latest?.eventType ?? null,
    stale,
  };
}

export function evaluateCloseLoopHealth(
  rows: EdgeFunctionLogRow[],
  now = new Date(),
  learningSignals: CloseLoopLearningSnapshot[] = []
): CloseLoopHealthReport {
  const latestByName = new Map<string, EdgeFunctionLogRow>();
  for (const row of rows) {
    if (!latestByName.has(row.function_name)) {
      latestByName.set(row.function_name, row);
    }
  }

  const pipelines = CLOSE_LOOP_REQUIRED_PIPELINES.map(name => {
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
    p => p.status === 'failed' || p.status === 'no_data' || p.stale
  );
  const hasYellow =
    !hasRed &&
    pipelines.some(p => p.status === 'partial' || p.clientsFailed > 0);

  return {
    checkedAt: now.toISOString(),
    overall: hasRed ? 'red' : hasYellow ? 'yellow' : 'green',
    pipelines,
    learningSignals,
  };
}

export async function fetchCloseLoopHealth(
  input: {
    organizationId?: string;
  } = {}
): Promise<CloseLoopHealthReport> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 14);

  // edge_function_logs holds aggregate pipeline runs (client_id is null), so
  // this read is platform-wide, exactly as before; only the learning signal
  // below is organisation-scoped.
  const logs = await prisma.edgeFunctionLog
    .findMany({
      where: {
        functionName: { in: [...CLOSE_LOOP_REQUIRED_PIPELINES] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        functionName: true,
        status: true,
        clientsProcessed: true,
        clientsFailed: true,
        durationMs: true,
        createdAt: true,
      },
    })
    .catch((error: unknown) => {
      throw new Error(
        `close-loop health query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });

  const rows: EdgeFunctionLogRow[] = logs.map(log => ({
    function_name: log.functionName,
    status: log.status as EdgeFunctionLogRow['status'],
    clients_processed: log.clientsProcessed,
    clients_failed: log.clientsFailed,
    duration_ms: log.durationMs,
    created_at: log.createdAt.toISOString(),
  }));

  const learningSignals: CloseLoopLearningSnapshot[] = [];
  if (input.organizationId) {
    const outcomeEvents = await prisma.marketingAgencyOutcomeEvent
      .findMany({
        where: {
          organizationId: input.organizationId,
        },
        orderBy: { recordedAt: 'desc' },
        take: 25,
        select: {
          eventType: true,
          recordedAt: true,
        },
      })
      .catch((): MarketingAgencyOutcomeRow[] => []);

    learningSignals.push(
      evaluateMarketingAgencyOutcomeLearning(outcomeEvents, now)
    );
  }

  return evaluateCloseLoopHealth(rows, now, learningSignals);
}
