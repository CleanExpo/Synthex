/**
 * J9 boundary fakes: an in-memory Prisma client, Redis client and logger.
 *
 * Only the BOUNDARY is faked (the database, Redis, the logger sink). The code
 * under test (governor, budget-enforcer, spend-log, meter, video quota) runs
 * for real on top of it, so every cap, hold and settlement decision is the
 * product's own.
 *
 * State lives on globalThis because invokeRoute() loads route modules under
 * jest.isolateModules, which re-runs mock factories in a fresh registry. A
 * module-level singleton would split into two databases; a global cannot.
 */
import { Prisma } from '@prisma/client';

export interface LedgerRow {
  pipelineName: string;
  clientId: string | null;
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  provider?: string | null;
  outcome?: string | null;
  provenance?: unknown;
  createdAt: Date;
}

export interface SpendEvent {
  eventKey: string;
  holdId: string;
  organizationId: string;
  initiatedBy: string;
  kind: string;
  deltaUsd: Prisma.Decimal;
  windowAt: Date;
  mediaType?: string;
  runId?: string;
  createdAt?: Date;
}

export interface J9State {
  /** Boundary methods that throw, keyed 'model.method' (e.g. 'orgBudgetPolicy.findUnique'). */
  failures: Set<string>;
  budgetPolicies: Map<string, Record<string, unknown>>;
  ledger: LedgerRow[];
  runnerFlags: Array<{
    organizationId: string;
    brandSlug: string;
    runner: string;
    enabled: boolean;
    killSwitch: boolean;
  }>;
  credentials: Array<{
    organizationId: string;
    provider: string;
    id: string;
    encryptedKey: string;
    isActive: boolean;
    revokedAt: Date | null;
  }>;
  quotas: Map<string, { monthlyBudgetUsd: number; dailyBudgetUsd: number }>;
  events: SpendEvent[];
  attempts: Map<string, Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  redis: Map<string, number>;
  logs: Array<{ level: string; message: string; meta?: unknown }>;
  /** Provider-boundary call counters (fal submit, paid prompt enhancer, ...). */
  calls: Record<string, number>;
}

const g = globalThis as unknown as { __j9State?: J9State };

export function state(): J9State {
  if (!g.__j9State) {
    g.__j9State = {
      failures: new Set(),
      budgetPolicies: new Map(),
      ledger: [],
      runnerFlags: [],
      credentials: [],
      quotas: new Map(),
      events: [],
      attempts: new Map(),
      videos: [],
      redis: new Map(),
      logs: [],
      calls: {},
    };
  }
  return g.__j9State;
}

export function resetState(): void {
  g.__j9State = undefined;
  state();
}

export function bump(name: string): number {
  const s = state();
  s.calls[name] = (s.calls[name] ?? 0) + 1;
  return s.calls[name];
}

export function calls(name: string): number {
  return state().calls[name] ?? 0;
}

function maybeFail(key: string): void {
  if (state().failures.has(key)) {
    throw new Error(`J9 planted read failure: ${key}`);
  }
}

function duplicate(): Error {
  return new Prisma.PrismaClientKnownRequestError('duplicate event key', {
    code: 'P2002',
    clientVersion: 'j9-fake',
  });
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/** Net media spend for an organisation (sum of every event delta). */
export function netMediaSpend(organizationId: string, holdId?: string): number {
  return state()
    .events.filter(
      e =>
        e.organizationId === organizationId &&
        (holdId === undefined || e.holdId === holdId)
    )
    .reduce((t, e) => t + Number(e.deltaUsd), 0);
}

/** Seed prior media spend (a reserve event dated now). */
export function seedMediaSpend(
  organizationId: string,
  amountUsd: number,
  initiatedBy = 'studio'
): void {
  const holdId = `seed-${organizationId}-${state().events.length}`;
  state().events.push({
    eventKey: `hold:${holdId}:reserve`,
    holdId,
    organizationId,
    initiatedBy,
    kind: 'reserve',
    deltaUsd: new Prisma.Decimal(amountUsd),
    windowAt: new Date(),
    mediaType: 'image',
  });
}

function sumLedger(where: {
  clientId?: string;
  runId?: string;
  createdAt?: { gte?: Date };
}): LedgerRow[] {
  return state().ledger.filter(
    r =>
      (where.clientId === undefined || r.clientId === where.clientId) &&
      (where.runId === undefined || r.runId === where.runId) &&
      (where.createdAt?.gte === undefined || r.createdAt >= where.createdAt.gte)
  );
}

function quotaFor(organizationId: string) {
  return state().quotas.get(organizationId);
}

const tx = {
  async $executeRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
    maybeFail('$executeRaw');
    const organizationId = String(values[1]);
    if (!quotaFor(organizationId)) {
      // Schema defaults (spend-log.ts spendSnapshot mirrors them).
      state().quotas.set(organizationId, {
        monthlyBudgetUsd: 75,
        dailyBudgetUsd: 15,
      });
    }
    return 1;
  },
  async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    maybeFail('$queryRaw');
    const sql = strings.join('?');
    if (sql.includes('FOR UPDATE')) {
      const q = quotaFor(String(values[0]));
      if (!q) return [];
      const now = new Date();
      return [
        {
          monthly_budget_usd: String(q.monthlyBudgetUsd),
          daily_budget_usd: String(q.dailyBudgetUsd),
          spent_usd: '0',
          spent_today_usd: '0',
          period_start: now,
          day_start: now,
        },
      ];
    }
    if (sql.includes('pipeline_cost_ledger')) {
      // backfillMediaSpendLedger: charged video/audio holds finalised since
      // `since` with no ledger row for the hold.
      const [since] = values as [Date];
      const events = state().events;
      return events
        .filter(
          f =>
            (f.kind === 'settle' || f.kind === 'sweep') &&
            (f.createdAt ?? f.windowAt) >= since
        )
        .flatMap(f => {
          const r = events.find(
            e => e.holdId === f.holdId && e.kind === 'reserve'
          );
          if (!r || (r.mediaType !== 'video' && r.mediaType !== 'audio')) {
            return [];
          }
          if (Number(r.deltaUsd) + Number(f.deltaUsd) <= 0) return [];
          if (state().ledger.some(l => l.runId === f.holdId)) return [];
          return [{ hold_id: f.holdId, media_type: r.mediaType }];
        });
    }
    if (sql.includes('media_spend_events')) {
      const [dayStart, monthStart, , organizationId] = values as [
        Date,
        Date,
        Date,
        string,
      ];
      let daily = 0;
      let monthly = 0;
      let mcp = 0;
      for (const e of state().events) {
        if (e.organizationId !== organizationId) continue;
        const v = Number(e.deltaUsd);
        if (e.windowAt >= dayStart) daily += v;
        if (e.windowAt >= monthStart) monthly += v;
        if (e.windowAt >= dayStart && e.initiatedBy === 'mcp') mcp += v;
      }
      return [
        { daily: String(daily), monthly: String(monthly), mcp: String(mcp) },
      ];
    }
    throw new Error(`J9 fake: unhandled raw query: ${sql.slice(0, 80)}`);
  },
  mediaSpendEvent: {
    async createMany({ data }: { data: SpendEvent[] }) {
      maybeFail('mediaSpendEvent.createMany');
      const keys = new Set(state().events.map(e => e.eventKey));
      if (data.some(d => keys.has(d.eventKey))) throw duplicate();
      state().events.push(...data.map(d => ({ ...d })));
      return { count: data.length };
    },
    async create({ data }: { data: SpendEvent }) {
      maybeFail('mediaSpendEvent.create');
      if (state().events.some(e => e.eventKey === data.eventKey)) {
        throw duplicate();
      }
      state().events.push({ ...data, createdAt: new Date() });
      return data;
    },
    async findUnique({ where }: { where: { eventKey: string } }) {
      maybeFail('mediaSpendEvent.findUnique');
      const e = state().events.find(x => x.eventKey === where.eventKey);
      return e
        ? {
            ...e,
            mediaType: e.mediaType ?? null,
            createdAt: e.createdAt ?? e.windowAt,
          }
        : null;
    },
  },
};

export const fakePrisma = {
  ...tx,
  async $transaction<T>(fn: (t: typeof tx) => Promise<T>): Promise<T> {
    maybeFail('$transaction');
    const snapshot = state().events.length;
    try {
      return await fn(tx);
    } catch (error) {
      state().events.length = snapshot; // roll back
      throw error;
    }
  },
  orgBudgetPolicy: {
    async findUnique({ where }: { where: { organizationId: string } }) {
      maybeFail('orgBudgetPolicy.findUnique');
      return state().budgetPolicies.get(where.organizationId) ?? null;
    },
  },
  pipelineCostLedger: {
    async groupBy({
      where,
    }: {
      where: { clientId: string; createdAt: { gte: Date } };
    }) {
      maybeFail('pipelineCostLedger.groupBy');
      const groups = new Map<string | null, number>();
      for (const r of sumLedger(where)) {
        const k = r.provider ?? null;
        groups.set(k, (groups.get(k) ?? 0) + r.costUsd);
      }
      return Array.from(groups, ([provider, costUsd]) => ({
        provider,
        _sum: { costUsd },
      }));
    },
    async aggregate({
      where,
    }: {
      where: { clientId?: string; runId?: string; createdAt?: { gte?: Date } };
    }) {
      maybeFail('pipelineCostLedger.aggregate');
      const rows = sumLedger(where);
      return {
        _sum: {
          costUsd: rows.length ? rows.reduce((t, r) => t + r.costUsd, 0) : null,
        },
      };
    },
    async findFirst({
      where,
    }: {
      where: { runId: string; pipelineName?: string };
    }) {
      maybeFail('pipelineCostLedger.findFirst');
      const row = state().ledger.find(
        r =>
          r.runId === where.runId &&
          (where.pipelineName === undefined ||
            r.pipelineName === where.pipelineName)
      );
      return row ? { id: `ledger-${row.runId}` } : null;
    },
    async create({
      data,
    }: {
      data: Omit<LedgerRow, 'createdAt'> & { createdAt?: Date };
    }) {
      maybeFail('pipelineCostLedger.create');
      const row = {
        ...data,
        createdAt: data.createdAt ?? new Date(),
      } as LedgerRow;
      state().ledger.push(row);
      return { id: `ledger-${state().ledger.length}`, ...row };
    },
  },
  runnerFlag: {
    async findMany({
      where,
    }: {
      where: {
        organizationId: string;
        brandSlug: string;
        runner: { in: string[] };
      };
    }) {
      maybeFail('runnerFlag.findMany');
      return state().runnerFlags.filter(
        f =>
          f.organizationId === where.organizationId &&
          f.brandSlug === where.brandSlug &&
          where.runner.in.includes(f.runner)
      );
    },
  },
  aPICredential: {
    async findMany({
      where,
    }: {
      where: { organizationId: string; provider: string };
    }) {
      maybeFail('aPICredential.findMany');
      return state().credentials.filter(
        c =>
          c.organizationId === where.organizationId &&
          c.provider === where.provider
      );
    },
  },
  organizationVideoQuota: {
    async findUnique({ where }: { where: { organizationId: string } }) {
      maybeFail('organizationVideoQuota.findUnique');
      return quotaFor(where.organizationId) ?? null;
    },
  },
  mediaProviderAttempt: {
    async upsert({
      where,
      create,
      update,
    }: {
      where: { attemptKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      maybeFail('mediaProviderAttempt.upsert');
      const existing = state().attempts.get(where.attemptKey);
      if (!existing) {
        state().attempts.set(where.attemptKey, { ...create });
      } else {
        for (const [k, v] of Object.entries(update)) {
          if (v !== undefined) existing[k] = v;
        }
      }
      return state().attempts.get(where.attemptKey);
    },
    async findMany({ where }: { where: { holdId: string } }) {
      maybeFail('mediaProviderAttempt.findMany');
      return Array.from(state().attempts.values()).filter(
        a => a.holdId === where.holdId
      );
    },
  },
  videoGeneration: {
    async create({ data }: { data: Record<string, unknown> }) {
      maybeFail('videoGeneration.create');
      const row = { id: `video-${state().videos.length + 1}`, ...data };
      state().videos.push(row);
      return row;
    },
    async findFirst({
      where,
    }: {
      where: { providerJobId: string; mode: string };
    }) {
      return (
        state().videos.find(
          v => v.providerJobId === where.providerJobId && v.mode === where.mode
        ) ?? null
      );
    },
    async updateMany({
      where,
      data,
    }: {
      where: { id: string; status: string };
      data: Record<string, unknown>;
    }) {
      const row = state().videos.find(
        v => v.id === where.id && v.status === where.status
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
};

export function prismaModule() {
  return { __esModule: true, default: fakePrisma, prisma: fakePrisma };
}

export function loggerModule() {
  const sink =
    (level: string) =>
    (message: string, meta?: unknown): void => {
      state().logs.push({ level, message, meta });
    };
  return {
    __esModule: true,
    logger: {
      debug: sink('debug'),
      info: sink('info'),
      warn: sink('warn'),
      error: sink('error'),
    },
  };
}

export function redisModule() {
  const r = () => state().redis;
  const client = {
    async get(key: string) {
      return r().has(key) ? String(r().get(key)) : null;
    },
    async incrby(key: string, n: number) {
      r().set(key, (r().get(key) ?? 0) + n);
      return r().get(key) as number;
    },
    async decrby(key: string, n: number) {
      r().set(key, (r().get(key) ?? 0) - n);
      return r().get(key) as number;
    },
    async expire() {
      return 1;
    },
  };
  return { __esModule: true, getRedisClient: () => client };
}

export { startOfUtcDay };
