/**
 * ops_* namespace — M11 read-only operations tools (spec 2026-10-17, P5).
 *   - ops_get_platform_health: the facts GET /api/health reports (database,
 *     cache, environment, overall status, version) minus anything sensitive —
 *     no env var names, no DB error text (it can carry a connection string),
 *     no pool or memory internals.
 *   - ops_get_org_spend_totals: the caller org's spend over a date range from
 *     pipeline_cost_ledger (clientId = organizationId) and media_spend_events
 *     (windowAt, the reserve instant both delta events are keyed to). Named
 *     _totals because the v1 registry guard reserves the `_spend` suffix.
 *   - ops_list_cron_outcomes: no table records cron run outcomes (searched
 *     prisma/schema.prisma), so it answers not provisioned, never an empty list.
 *
 * Scope 'ops' (explicit key scope or '*'; empty scopes see nothing). The
 * organisation always comes from the caller key (ctx), never from args.
 * A failed read never looks like an empty success: a missing table is
 * reported as unavailable (lib/api/not-provisioned.ts) and any other read
 * error propagates.
 */
import { z } from 'zod';
import prisma, { checkDatabaseHealth } from '@/lib/prisma';
import { validateEnv } from '@/lib/env';
import {
  FEATURE_NOT_PROVISIONED,
  tableUnavailable,
} from '@/lib/api/not-provisioned';
import type { StudioTool } from './types';

const HealthStatus = z.enum(['healthy', 'degraded', 'unhealthy']);
type HealthStatus = z.infer<typeof HealthStatus>;

const HealthCheck = z.object({
  status: HealthStatus,
  latencyMs: z.number().nullable(),
  message: z.string(),
});

const PlatformHealthOutput = z.object({
  status: HealthStatus,
  checkedAt: z.string(),
  version: z.string(),
  buildId: z.string(),
  checks: z.object({
    database: HealthCheck,
    cache: HealthCheck,
    environment: z.object({
      status: HealthStatus,
      missingRequired: z.number(),
      errors: z.number(),
    }),
  }),
});

const IsoDate = z.iso.date();
const OrgSpendArgs = z.object({
  /** Inclusive UTC day, YYYY-MM-DD. Default: 29 days before `to`. */
  from: IsoDate.optional(),
  /** Inclusive UTC day, YYYY-MM-DD. Default: today (UTC). */
  to: IsoDate.optional(),
});

const Unavailable = z.object({
  available: z.literal(false),
  reason: z.string(),
});

const OrgSpendOutput = z.object({
  organizationId: z.string(),
  from: z.string(),
  to: z.string(),
  /** Sum of the available sources only; check each source's `available`. */
  totalUsd: z.number(),
  pipelineLedger: z.union([
    z.object({
      available: z.literal(true),
      totalUsd: z.number(),
      runs: z.number(),
      byProvider: z.array(
        z.object({
          provider: z.string(),
          costUsd: z.number(),
          runs: z.number(),
        })
      ),
      byPipeline: z.array(
        z.object({
          pipelineName: z.string(),
          costUsd: z.number(),
          runs: z.number(),
        })
      ),
    }),
    Unavailable,
  ]),
  mediaSpend: z.union([
    z.object({
      available: z.literal(true),
      totalUsd: z.number(),
      events: z.number(),
      byMediaType: z.array(
        z.object({ mediaType: z.string(), costUsd: z.number() })
      ),
    }),
    Unavailable,
  ]),
});

const CronOutcomesOutput = Unavailable;

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;
const round6 = (n: number) => parseFloat(n.toFixed(6));
const VERSION = process.env.npm_package_version || '2.0.1';
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

/** Prisma P2021: the table does not exist (migration not applied). */
const isTableMissing = (err: unknown) =>
  (err as { code?: unknown } | null)?.code === 'P2021';

async function readOrUnavailable<T>(table: string, read: () => Promise<T>) {
  try {
    return await read();
  } catch (err) {
    if (isTableMissing(err)) return tableUnavailable(table);
    throw err;
  }
}

/** Sum rows into a sorted { key, costUsd, runs } list (largest first). */
function rollUp<K extends string>(
  rows: Array<{ key: string; costUsd: number; runs: number }>,
  keyName: K
) {
  const acc = new Map<string, { costUsd: number; runs: number }>();
  for (const r of rows) {
    const cur = acc.get(r.key) ?? { costUsd: 0, runs: 0 };
    acc.set(r.key, {
      costUsd: cur.costUsd + r.costUsd,
      runs: cur.runs + r.runs,
    });
  }
  return [...acc.entries()]
    .sort((a, b) => b[1].costUsd - a[1].costUsd)
    .map(([key, v]) => ({
      [keyName]: key,
      costUsd: round6(v.costUsd),
      runs: v.runs,
    })) as Array<Record<K, string> & { costUsd: number; runs: number }>;
}

function worst(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}

async function databaseCheck() {
  const started = Date.now();
  const result = await Promise.race([
    checkDatabaseHealth().catch(() => ({ healthy: false })),
    new Promise<{ healthy: false; timedOut: true }>(resolve =>
      setTimeout(() => resolve({ healthy: false, timedOut: true }), 5000)
    ),
  ]);
  const latencyMs = Date.now() - started;
  // Same thresholds as GET /api/health; the DB error text is never echoed.
  if (!result.healthy)
    return {
      status: 'unhealthy' as const,
      latencyMs,
      message: 'timedOut' in result ? 'Timeout' : 'Connection failed',
    };
  return {
    status: latencyMs > 2500 ? ('degraded' as const) : ('healthy' as const),
    latencyMs,
    message: 'Connected',
  };
}

async function cacheCheck() {
  const started = Date.now();
  try {
    const { healthCheck } = await import('@/lib/redis-unified');
    const health = (await Promise.race([
      healthCheck(),
      new Promise(resolve =>
        setTimeout(
          () => resolve({ status: 'degraded', connection: 'memory' }),
          3000
        )
      ),
    ])) as { status?: unknown; connection?: unknown };
    const status = HealthStatus.safeParse(health.status);
    return {
      status: status.success ? status.data : ('degraded' as const),
      latencyMs: Date.now() - started,
      message:
        health.connection === 'redis' || health.connection === 'memory'
          ? `connection: ${health.connection}`
          : 'connection: unknown',
    };
  } catch {
    return {
      status: 'degraded' as const,
      latencyMs: Date.now() - started,
      message: 'Using memory fallback',
    };
  }
}

function environmentCheck() {
  const result = validateEnv();
  // Counts only: env var names are configuration facts we do not expose.
  return {
    status:
      result.missingRequired.length > 0
        ? ('unhealthy' as const)
        : ('healthy' as const),
    missingRequired: result.missingRequired.length,
    errors: result.errors.length,
  };
}

export const OPS_TOOLS: StudioTool[] = [
  {
    name: 'ops_get_platform_health',
    description:
      'Platform health as GET /api/health reports it: overall status, database and cache status with latency, environment status as counts, version and build. Never includes env var names, secrets or raw error text. Read-only.',
    scope: 'ops',
    riskClass: 'read',
    costClass: 'free',
    schema: z.object({}),
    outputSchema: PlatformHealthOutput,
    execute: async () => {
      const [database, cache] = await Promise.all([
        databaseCheck(),
        cacheCheck(),
      ]);
      const environment = environmentCheck();
      return {
        status: worst([database.status, cache.status, environment.status]),
        checkedAt: new Date().toISOString(),
        version: VERSION,
        buildId: BUILD_ID,
        checks: { database, cache, environment },
      };
    },
  },
  {
    name: 'ops_get_org_spend_totals',
    description:
      "The caller organisation's spend for a UTC date range (default: the last 30 days, at most 366): pipeline_cost_ledger totals by provider and by pipeline, and media_spend_events totals by media type. A source whose table is not provisioned is reported as available:false, never as zero. Read-only.",
    scope: 'ops',
    riskClass: 'read',
    costClass: 'free',
    schema: OrgSpendArgs,
    outputSchema: OrgSpendOutput,
    execute: async (args, ctx) => {
      const a = OrgSpendArgs.parse(args);
      const to = a.to ?? new Date().toISOString().slice(0, 10);
      const toEnd = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY_MS);
      const from =
        a.from ??
        new Date(toEnd.getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
      const fromStart = new Date(`${from}T00:00:00.000Z`);
      if (fromStart >= toEnd)
        throw new Error(`from (${from}) is after to (${to})`);
      if (toEnd.getTime() - fromStart.getTime() > MAX_RANGE_DAYS * DAY_MS)
        throw new Error(`date range exceeds ${MAX_RANGE_DAYS} days`);
      const range = { gte: fromStart, lt: toEnd };

      const [pipelineLedger, mediaSpend] = await Promise.all([
        readOrUnavailable('pipeline_cost_ledger', async () => {
          const rows = await prisma.pipelineCostLedger.groupBy({
            by: ['provider', 'pipelineName'],
            // clientId equality excludes board-level (null) rows.
            where: { clientId: ctx.organizationId, createdAt: range },
            _sum: { costUsd: true },
            _count: { _all: true },
          });
          const flat = rows.map(r => ({
            provider: r.provider ?? 'unknown',
            pipelineName: r.pipelineName,
            costUsd: Number(r._sum.costUsd ?? 0),
            runs: r._count._all,
          }));
          return {
            available: true as const,
            totalUsd: round6(flat.reduce((s, r) => s + r.costUsd, 0)),
            runs: flat.reduce((s, r) => s + r.runs, 0),
            byProvider: rollUp(
              flat.map(r => ({ ...r, key: r.provider })),
              'provider'
            ),
            byPipeline: rollUp(
              flat.map(r => ({ ...r, key: r.pipelineName })),
              'pipelineName'
            ),
          };
        }),
        readOrUnavailable('media_spend_events', async () => {
          const rows = await prisma.mediaSpendEvent.groupBy({
            by: ['mediaType'],
            where: { organizationId: ctx.organizationId, windowAt: range },
            _sum: { deltaUsd: true },
            _count: { _all: true },
          });
          const flat = rows.map(r => ({
            key: r.mediaType ?? 'unknown',
            costUsd: Number(r._sum.deltaUsd ?? 0),
            runs: r._count._all,
          }));
          return {
            available: true as const,
            totalUsd: round6(flat.reduce((s, r) => s + r.costUsd, 0)),
            events: flat.reduce((s, r) => s + r.runs, 0),
            byMediaType: rollUp(flat, 'mediaType').map(
              ({ mediaType, costUsd }) => ({ mediaType, costUsd })
            ),
          };
        }),
      ]);

      const sum = [pipelineLedger, mediaSpend].reduce(
        (s, src) => s + (src.available ? src.totalUsd : 0),
        0
      );
      return {
        organizationId: ctx.organizationId,
        from,
        to,
        totalUsd: round6(sum),
        pipelineLedger,
        mediaSpend,
      };
    },
  },
  {
    name: 'ops_list_cron_outcomes',
    description:
      'Last run outcome per cron job. No table records cron run outcomes yet, so this answers available:false with the reason rather than an empty list. Read-only.',
    scope: 'ops',
    riskClass: 'read',
    costClass: 'free',
    schema: z.object({}),
    outputSchema: CronOutcomesOutput,
    execute: async () => ({
      available: false as const,
      reason: `${FEATURE_NOT_PROVISIONED}: no table records cron run outcomes; nothing was read.`,
    }),
  },
];
