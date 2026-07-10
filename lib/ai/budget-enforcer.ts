/**
 * BUDGET-ENFORCER — org-level pre-spend budget enforcement.
 *
 * Successor slice to SYN-MCP-002/003: those threaded per-request budget
 * fields (GenerationBudget.maxCostUsd, enforced in generation-context.ts) but
 * nothing enforced an ORGANISATION ceiling before a provider call —
 * lib/pipelines/track-cost.ts only RECORDS spend to pipeline_cost_ledger.
 *
 * This module adds the org-ceiling layer at the orchestration seams 002/003
 * prepared (generate-content single/batch, calendar enqueue + worker). It
 * never touches provider clients.
 *
 * Model:
 *   window spend  = Prisma SUM over pipeline_cost_ledger
 *                   (clientId, createdAt — index exists; counts BOTH write
 *                   paths: recordGenerationCost via Prisma and the
 *                   supabase-js trackPipelineCost writer, same table)
 *   in-flight     = Redis atomic INCRBY counters (micro-USD integers) per
 *                   org per UTC day/month, TTL to window end (self-heals
 *                   leaked reservations at the window boundary)
 *   reserve       = INCRBY first, THEN check (spend + in-flight) against the
 *                   ceiling — atomic against races: N concurrent
 *                   near-ceiling requests each see a running total that
 *                   includes the others' reservations, so they can never
 *                   jointly breach (TOCTOU-safe).
 *   commit/release= DECRBY the same counters (actuals land in the ledger via
 *                   the existing recordGenerationCost, so nothing is
 *                   double-counted for longer than the ledger-write gap).
 *
 * FAIL-OPEN DOCTRINE (deploy safety — prod migrations are founder-gated and
 * lag deploys): missing table (P2021), missing row, or ANY policy/ledger/
 * redis read error ⇒ log-only warn and proceed. Fail-closed
 * (OrgBudgetExceededError → HTTP 402) happens ONLY on a live OrgBudgetPolicy
 * row with enforcementMode='enforce' and a computed breach. With zero policy
 * rows and the env defaults unset, every function here is a no-op.
 *
 * Env defaults (log-only observability when no policy row exists):
 *   SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD
 *   SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD
 */

import { randomUUID } from 'crypto';
import { getRedisClient } from '@/lib/redis-client';
import { logger } from '@/lib/logger';
import {
  estimateContentGenerationCostUsd,
  isSystemOrganization,
  type GenerationContext,
} from '@/lib/ai/generation-context';

// ---------------------------------------------------------------------------
// Types + error
// ---------------------------------------------------------------------------

export type BudgetWindow = 'daily' | 'monthly';
export type BudgetEnforcementMode = 'enforce' | 'log_only';
export type BudgetPolicySource = 'policy_row' | 'env_default' | 'none';

/**
 * Ceiling breach under an ENFORCING policy. Routes map this to HTTP 402
 * (consistent with GenerationBudgetExceededError handling in
 * app/api/ai/generate-content/route.ts); queue workers let it fail the job
 * with a typed message on job.error.
 */
export class OrgBudgetExceededError extends Error {
  constructor(
    public readonly organizationId: string,
    public readonly window: BudgetWindow,
    public readonly spendUsd: number,
    public readonly inFlightUsd: number,
    public readonly estimatedCostUsd: number,
    public readonly ceilingUsd: number
  ) {
    super(
      `Organization ${organizationId} ${window} AI budget exceeded: ` +
        `spend $${spendUsd.toFixed(4)} + in-flight $${inFlightUsd.toFixed(4)} ` +
        `+ estimated $${estimatedCostUsd.toFixed(4)} exceeds the ` +
        `$${ceilingUsd.toFixed(2)} ceiling. Raise the organisation's budget ` +
        `policy or retry after the ${window} window resets.`
    );
    this.name = 'OrgBudgetExceededError';
  }
}

/** Handle returned by reserveBudget; pass to commitActual/releaseReservation. */
export interface OrgBudgetReservation {
  /** Reservation id (observability only — state lives in the Redis counters). */
  id: string;
  organizationId: string;
  /** Reserved amount, micro-USD integer (atomic counter unit). */
  amountMicroUsd: number;
  /** Reserved amount in USD (= amountMicroUsd / 1e6). */
  amountUsd: number;
  /** UTC day key (YYYY-MM-DD) the daily counter was incremented under. */
  dayKey: string;
  /** UTC month key (YYYY-MM) the monthly counter was incremented under. */
  monthKey: string;
  /** Mode the reservation was made under. */
  mode: BudgetEnforcementMode;
  /** Trace id for ledger reconciliation (ctx.traceId). */
  traceId?: string;
  /** Set once committed/released — makes settle operations idempotent. */
  settled: boolean;
}

export interface OrgSpendSnapshot {
  organizationId: string;
  dailySpendUsd: number;
  monthlySpendUsd: number;
  /** Sum currently reserved but not yet committed/released, USD. */
  inFlightReservedUsd: { daily: number; monthly: number };
  dailyCeilingUsd: number | null;
  monthlyCeilingUsd: number | null;
  enforcementMode: BudgetEnforcementMode;
  policySource: BudgetPolicySource;
}

interface ResolvedBudgetPolicy {
  source: BudgetPolicySource;
  mode: BudgetEnforcementMode;
  dailyCeilingUsd: number | null;
  monthlyCeilingUsd: number | null;
}

// ---------------------------------------------------------------------------
// Estimators (reuse the canonical MODEL_RATES via generation-context)
// ---------------------------------------------------------------------------

/**
 * Worst-case USD estimate for one calendar generation run. The existing
 * estimator (estimateContentGenerationCostUsd) covers a single content
 * request (main + 2 variation calls); a calendar run is
 * days × platforms × postsPerDay such requests
 * (AIContentGenerator.generateContentCalendar fans out generateContent).
 */
export function estimateCalendarGenerationCostUsd(
  days: number,
  platforms: number | ReadonlyArray<unknown>,
  postsPerDay: number
): number {
  const platformCount = Array.isArray(platforms)
    ? platforms.length
    : Number(platforms);
  const posts =
    Math.max(0, Math.trunc(days)) *
    Math.max(0, Math.trunc(platformCount)) *
    Math.max(0, Math.trunc(postsPerDay));
  return parseFloat(
    (posts * estimateContentGenerationCostUsd({ type: 'post' })).toFixed(6)
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MICRO = 1_000_000;

function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.ceil(usd * MICRO);
}

function fromMicroUsd(micro: number): number {
  return micro / MICRO;
}

function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function utcMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Seconds until the end of the UTC day, plus a small grace period. */
function ttlToEndOfUtcDay(now: Date): number {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(60, Math.ceil((end - now.getTime()) / 1000) + 60);
}

/** Seconds until the end of the UTC month, plus a small grace period. */
function ttlToEndOfUtcMonth(now: Date): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(60, Math.ceil((end - now.getTime()) / 1000) + 60);
}

function dailyCounterKey(organizationId: string, dayKey: string): string {
  return `budget:inflight:${organizationId}:d:${dayKey}`;
}

function monthlyCounterKey(organizationId: string, monthKey: string): string {
  return `budget:inflight:${organizationId}:m:${monthKey}`;
}

function parseEnvCeiling(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function warn(message: string, meta: Record<string, unknown>): void {
  try {
    logger.warn(`budget-enforcer: ${message}`, meta);
  } catch {
    // Logging must never throw.
  }
}

/**
 * Resolve the effective policy for an org. NEVER throws — any read error
 * degrades to env defaults in log_only mode (fail-open; the table may not
 * exist yet on a deploy that precedes the founder-applied migration).
 */
async function resolveOrgBudgetPolicy(
  organizationId: string
): Promise<ResolvedBudgetPolicy> {
  const envDaily = parseEnvCeiling(
    process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD
  );
  const envMonthly = parseEnvCeiling(
    process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD
  );

  try {
    const { default: prisma } = await import('@/lib/prisma');
    const row = await prisma.orgBudgetPolicy.findUnique({
      where: { organizationId },
    });
    if (row) {
      return {
        source: 'policy_row',
        // Only the literal 'enforce' fails closed — anything else is log-only.
        mode: row.enforcementMode === 'enforce' ? 'enforce' : 'log_only',
        dailyCeilingUsd: row.dailyCeilingUsd ?? envDaily,
        monthlyCeilingUsd: row.monthlyCeilingUsd ?? envMonthly,
      };
    }
  } catch (error) {
    // P2021 (table missing), connection failure, mocked client without the
    // model — all fail open per the deploy-safety contract.
    warn('policy read failed — proceeding log-only (fail-open)', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (envDaily !== null || envMonthly !== null) {
    return {
      source: 'env_default',
      mode: 'log_only',
      dailyCeilingUsd: envDaily,
      monthlyCeilingUsd: envMonthly,
    };
  }
  return {
    source: 'none',
    mode: 'log_only',
    dailyCeilingUsd: null,
    monthlyCeilingUsd: null,
  };
}

/** Committed ledger spend for the org since `since`. Throws on read failure. */
async function ledgerWindowSpendUsd(
  organizationId: string,
  since: Date
): Promise<number> {
  const { default: prisma } = await import('@/lib/prisma');
  const aggregate = await prisma.pipelineCostLedger.aggregate({
    _sum: { costUsd: true },
    where: { clientId: organizationId, createdAt: { gte: since } },
  });
  return aggregate._sum.costUsd ?? 0;
}

async function readCounterMicro(key: string): Promise<number> {
  const redis = getRedisClient();
  const raw = await redis.get(key);
  const value = parseInt(raw ?? '0', 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

// ---------------------------------------------------------------------------
// Public API — reservation lifecycle
// ---------------------------------------------------------------------------

/**
 * Reserve `estimatedCostUsd` against the org's daily/monthly ceilings BEFORE
 * any provider call.
 *
 * Returns:
 *   - null                  → enforcement skipped (system org, no policy and
 *                             no env defaults, or a read failure — fail-open;
 *                             callers proceed exactly as today).
 *   - OrgBudgetReservation  → reserved; caller MUST commitActual() on success
 *                             or releaseReservation() on failure (a leaked
 *                             reservation self-heals at the window boundary
 *                             via the counter TTL).
 *
 * Throws OrgBudgetExceededError ONLY when a live policy row has
 * enforcementMode='enforce' and the window would breach (fail-closed). In
 * log_only mode a breach warns and the request proceeds.
 */
export async function reserveBudget(
  ctx: Pick<GenerationContext, 'organizationId'> &
    Partial<Pick<GenerationContext, 'traceId' | 'userId'>>,
  estimatedCostUsd: number
): Promise<OrgBudgetReservation | null> {
  const organizationId = ctx?.organizationId;
  if (!organizationId || isSystemOrganization(organizationId)) return null;

  const policy = await resolveOrgBudgetPolicy(organizationId);
  if (policy.dailyCeilingUsd === null && policy.monthlyCeilingUsd === null) {
    return null;
  }

  const now = new Date();
  let dailySpendUsd = 0;
  let monthlySpendUsd = 0;
  try {
    [dailySpendUsd, monthlySpendUsd] = await Promise.all([
      policy.dailyCeilingUsd !== null
        ? ledgerWindowSpendUsd(organizationId, startOfUtcDay(now))
        : Promise.resolve(0),
      policy.monthlyCeilingUsd !== null
        ? ledgerWindowSpendUsd(organizationId, startOfUtcMonth(now))
        : Promise.resolve(0),
    ]);
  } catch (error) {
    // Ledger unreadable → cannot compute the window → fail open (skip).
    warn('ledger window read failed — skipping enforcement (fail-open)', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const amountMicroUsd = toMicroUsd(estimatedCostUsd);
  const dayKey = utcDayKey(now);
  const monthKey = utcMonthKey(now);
  const dailyKey = dailyCounterKey(organizationId, dayKey);
  const monthlyKey = monthlyCounterKey(organizationId, monthKey);

  const redis = getRedisClient();
  // INCR first, THEN check — atomic against concurrent reservations (each
  // caller's check includes every other caller's increment). The wrapper
  // never throws (memory fallback), so a redis outage degrades to
  // per-instance counting rather than breaking generation.
  const dailyTotalMicro = await redis.incrby(dailyKey, amountMicroUsd);
  await redis.expire(dailyKey, ttlToEndOfUtcDay(now));
  const monthlyTotalMicro = await redis.incrby(monthlyKey, amountMicroUsd);
  await redis.expire(monthlyKey, ttlToEndOfUtcMonth(now));

  const reservation: OrgBudgetReservation = {
    id: randomUUID(),
    organizationId,
    amountMicroUsd,
    amountUsd: fromMicroUsd(amountMicroUsd),
    dayKey,
    monthKey,
    mode: policy.mode,
    traceId: ctx.traceId,
    settled: false,
  };

  const breaches: Array<{
    window: BudgetWindow;
    spendUsd: number;
    inFlightUsd: number;
    ceilingUsd: number;
  }> = [];
  if (
    policy.dailyCeilingUsd !== null &&
    dailySpendUsd + fromMicroUsd(dailyTotalMicro) > policy.dailyCeilingUsd
  ) {
    breaches.push({
      window: 'daily',
      spendUsd: dailySpendUsd,
      inFlightUsd: fromMicroUsd(dailyTotalMicro - amountMicroUsd),
      ceilingUsd: policy.dailyCeilingUsd,
    });
  }
  if (
    policy.monthlyCeilingUsd !== null &&
    monthlySpendUsd + fromMicroUsd(monthlyTotalMicro) > policy.monthlyCeilingUsd
  ) {
    breaches.push({
      window: 'monthly',
      spendUsd: monthlySpendUsd,
      inFlightUsd: fromMicroUsd(monthlyTotalMicro - amountMicroUsd),
      ceilingUsd: policy.monthlyCeilingUsd,
    });
  }

  if (breaches.length > 0) {
    const breach = breaches[0];
    if (policy.mode === 'enforce' && policy.source === 'policy_row') {
      // Fail-closed: roll the reservation back and reject.
      await settleCounters(reservation);
      throw new OrgBudgetExceededError(
        organizationId,
        breach.window,
        breach.spendUsd,
        breach.inFlightUsd,
        fromMicroUsd(amountMicroUsd),
        breach.ceilingUsd
      );
    }
    // Log-only: observability, request proceeds unchanged.
    warn('org budget ceiling breached (log-only — request proceeds)', {
      organizationId,
      window: breach.window,
      spendUsd: breach.spendUsd,
      inFlightUsd: breach.inFlightUsd,
      estimatedCostUsd: fromMicroUsd(amountMicroUsd),
      ceilingUsd: breach.ceilingUsd,
      policySource: policy.source,
    });
  }

  return reservation;
}

/** DECRBY both window counters exactly once per reservation. Never throws. */
async function settleCounters(
  reservation: OrgBudgetReservation
): Promise<void> {
  if (reservation.settled) return;
  reservation.settled = true;
  if (reservation.amountMicroUsd <= 0) return;
  try {
    const redis = getRedisClient();
    await redis.decrby(
      dailyCounterKey(reservation.organizationId, reservation.dayKey),
      reservation.amountMicroUsd
    );
    await redis.decrby(
      monthlyCounterKey(reservation.organizationId, reservation.monthKey),
      reservation.amountMicroUsd
    );
  } catch (error) {
    // Counter TTL self-heals the leak at the window boundary.
    warn('counter settle failed — TTL will self-heal', {
      organizationId: reservation.organizationId,
      reservationId: reservation.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Commit a reservation after a SUCCESSFUL generation: releases the in-flight
 * amount (actual spend is now in pipeline_cost_ledger via the existing
 * recordGenerationCost/trackPipelineCost writers) and logs the
 * estimate-vs-actual reconciliation. Idempotent; never throws.
 *
 * @param actualCostUsd Optional known actual. When omitted, the ledger is
 *   consulted by traceId (best-effort, observability only).
 */
export async function commitActual(
  reservation: OrgBudgetReservation | null | undefined,
  actualCostUsd?: number
): Promise<void> {
  if (!reservation || reservation.settled) return;
  await settleCounters(reservation);

  // Reconciliation (observability only — never blocks, never throws).
  try {
    let actual = actualCostUsd;
    if (actual === undefined && reservation.traceId) {
      const { default: prisma } = await import('@/lib/prisma');
      const aggregate = await prisma.pipelineCostLedger.aggregate({
        _sum: { costUsd: true },
        where: {
          clientId: reservation.organizationId,
          runId: reservation.traceId,
        },
      });
      actual = aggregate._sum.costUsd ?? undefined;
    }
    if (typeof actual === 'number') {
      logger.info('budget-enforcer: reservation committed', {
        organizationId: reservation.organizationId,
        reservationId: reservation.id,
        reservedUsd: reservation.amountUsd,
        actualUsd: actual,
        deltaUsd: parseFloat((reservation.amountUsd - actual).toFixed(6)),
      });
    }
  } catch {
    // Reconciliation is best-effort.
  }
}

/**
 * Release a reservation after a FAILED generation (no spend happened).
 * Idempotent; never throws.
 */
export async function releaseReservation(
  reservation: OrgBudgetReservation | null | undefined
): Promise<void> {
  if (!reservation || reservation.settled) return;
  await settleCounters(reservation);
}

// ---------------------------------------------------------------------------
// Public API — read paths
// ---------------------------------------------------------------------------

/**
 * Read-only fast-fail check (no reservation held) — used at the calendar
 * enqueue route so an obviously-over-ceiling submission 402s immediately.
 * The worker re-checks authoritatively with an atomic reservation, so the
 * unavoidable gap between this preview and the worker run is safe.
 *
 * Throws OrgBudgetExceededError only under an enforcing policy row;
 * otherwise warns (log-only) or no-ops. Read failures fail open.
 */
export async function previewBudget(
  organizationId: string | undefined,
  estimatedCostUsd: number
): Promise<void> {
  if (!organizationId || isSystemOrganization(organizationId)) return;
  const policy = await resolveOrgBudgetPolicy(organizationId);
  if (policy.dailyCeilingUsd === null && policy.monthlyCeilingUsd === null) {
    return;
  }

  const now = new Date();
  let dailySpendUsd = 0;
  let monthlySpendUsd = 0;
  let dailyInFlightUsd = 0;
  let monthlyInFlightUsd = 0;
  try {
    [dailySpendUsd, monthlySpendUsd, dailyInFlightUsd, monthlyInFlightUsd] =
      await Promise.all([
        policy.dailyCeilingUsd !== null
          ? ledgerWindowSpendUsd(organizationId, startOfUtcDay(now))
          : Promise.resolve(0),
        policy.monthlyCeilingUsd !== null
          ? ledgerWindowSpendUsd(organizationId, startOfUtcMonth(now))
          : Promise.resolve(0),
        readCounterMicro(dailyCounterKey(organizationId, utcDayKey(now))).then(
          fromMicroUsd
        ),
        readCounterMicro(
          monthlyCounterKey(organizationId, utcMonthKey(now))
        ).then(fromMicroUsd),
      ]);
  } catch (error) {
    warn('preview read failed — skipping (fail-open)', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const evaluate = (
    window: BudgetWindow,
    spendUsd: number,
    inFlightUsd: number,
    ceilingUsd: number | null
  ): void => {
    if (ceilingUsd === null) return;
    if (spendUsd + inFlightUsd + estimatedCostUsd <= ceilingUsd) return;
    if (policy.mode === 'enforce' && policy.source === 'policy_row') {
      throw new OrgBudgetExceededError(
        organizationId,
        window,
        spendUsd,
        inFlightUsd,
        estimatedCostUsd,
        ceilingUsd
      );
    }
    warn('org budget ceiling would breach (log-only preview)', {
      organizationId,
      window,
      spendUsd,
      inFlightUsd,
      estimatedCostUsd,
      ceilingUsd,
      policySource: policy.source,
    });
  };

  evaluate('daily', dailySpendUsd, dailyInFlightUsd, policy.dailyCeilingUsd);
  evaluate(
    'monthly',
    monthlySpendUsd,
    monthlyInFlightUsd,
    policy.monthlyCeilingUsd
  );
}

/**
 * Current spend vs ceiling for an org — the admin read endpoint's payload
 * (app/api/admin/org-spend). Ledger/policy read failures propagate to the
 * caller (an ADMIN surface should see the error, unlike the enforcement
 * path, which fails open).
 */
export async function getOrgSpendSnapshot(
  organizationId: string
): Promise<OrgSpendSnapshot> {
  const policy = await resolveOrgBudgetPolicy(organizationId);
  const now = new Date();
  const [dailySpendUsd, monthlySpendUsd, dailyInFlight, monthlyInFlight] =
    await Promise.all([
      ledgerWindowSpendUsd(organizationId, startOfUtcDay(now)),
      ledgerWindowSpendUsd(organizationId, startOfUtcMonth(now)),
      readCounterMicro(dailyCounterKey(organizationId, utcDayKey(now))),
      readCounterMicro(monthlyCounterKey(organizationId, utcMonthKey(now))),
    ]);
  return {
    organizationId,
    dailySpendUsd,
    monthlySpendUsd,
    inFlightReservedUsd: {
      daily: fromMicroUsd(dailyInFlight),
      monthly: fromMicroUsd(monthlyInFlight),
    },
    dailyCeilingUsd: policy.dailyCeilingUsd,
    monthlyCeilingUsd: policy.monthlyCeilingUsd,
    enforcementMode: policy.mode,
    policySource: policy.source,
  };
}
