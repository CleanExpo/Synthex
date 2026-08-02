/**
 * APPEND-ONLY MEDIA SPEND LOG (SYN-1115, round-4 refactor).
 *
 * ## Why this replaces the counter
 *
 * Image spend was previously accounted by mutating a counter
 * (`organization_video_quotas.spent_usd`) and, later, by also writing a
 * mutable hold row. That model requires every increment and decrement to
 * happen EXACTLY ONCE across four independent failure domains — the quota row,
 * the hold row, the paid provider call and the cost ledger — none of which
 * share a transaction.
 *
 * Four review rounds of compensating actions (unclaim-on-failure, revert,
 * sweep-release) each relocated the failure instead of removing it, for one
 * structural reason: **a compensation cannot distinguish "the mutation did not
 * commit" from "the mutation committed but the response was lost".** Under
 * that ambiguity, retrying double-charges and not retrying strands the money.
 *
 * ## The model
 *
 *   spend(window) = SUM(delta_usd) over media_spend_events in the window
 *
 * Exactly two events per hold, each with a DETERMINISTIC key:
 *
 *   reserve   delta = +heldUsd              key `hold:{holdId}:reserve`
 *   finalize  delta = actualUsd - heldUsd   (settled)
 *             delta = -heldUsd              (released or swept)
 *             key `hold:{holdId}:final`
 *
 * The finalize key is SHARED by settle, release and the stale sweep. Whichever
 * lands first wins; the others hit the unique index and no-op. That single
 * property removes the whole class of defects the reviews kept finding:
 *
 *   - a replayed webhook re-derives the same key -> no double-settle;
 *   - a sweep racing a real settlement -> no double-subtract;
 *   - a crash after `reserve` -> the reservation simply stays counted until a
 *     finalize arrives, and the sweep's finalize is safe because it cannot
 *     overwrite a settlement that already happened;
 *   - no unclaim, no revert, no compensating write anywhere.
 *
 * ## Ceiling enforcement
 *
 * `organization_video_quotas` is retained as the CAP CONFIGURATION and as the
 * serialisation point: the reserve path locks that row `FOR UPDATE`, sums the
 * window, compares against the cap and inserts the reserve event inside one
 * transaction. Concurrent reservations therefore serialise on the row lock, so
 * N near-ceiling requests cannot jointly breach — the same guarantee the video
 * path's conditional `updateMany` provides, expressed transactionally.
 *
 * Video spend still mutates the counter columns directly, so the ceiling check
 * adds the counter's spend to the event-log sum: image and video continue to
 * share ONE per-organisation media budget (founder ruling R5). Migrating the
 * video path onto this log is deliberate follow-up work, not part of this
 * change.
 */
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
import type { InitiatedBy } from '@/lib/services/ai/video/types';

/** Fraction of the daily cap an agent-initiated run may consume. */
const MCP_DAILY_FRACTION = Number(
  process.env.VIDEO_MCP_DAILY_FRACTION ?? '0.5'
);

export type SpendEventKind = 'reserve' | 'settle' | 'release' | 'sweep';

export function reserveKey(holdId: string): string {
  return `hold:${holdId}:reserve`;
}

/**
 * ONE key for every terminal outcome. Settle, release and sweep all derive it,
 * so exactly one of them can ever be recorded for a given hold.
 */
export function finalizeKey(holdId: string): string {
  return `hold:${holdId}:final`;
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 7) === b.toISOString().slice(0, 7);
}

/** Unique-constraint violation — the event already exists, which is success. */
function isDuplicateEvent(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export interface SpendWindows {
  dailyUsd: number;
  monthlyUsd: number;
  mcpDailyUsd: number;
}

type TxClient = Prisma.TransactionClient;

/**
 * Spend derived from the event log for the day/month windows.
 * `SUM` over an append-only table — no counter to drift.
 */
async function sumWindows(
  tx: TxClient,
  organizationId: string,
  now: Date
): Promise<SpendWindows> {
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  const rows = await tx.$queryRaw<
    Array<{ daily: string | null; monthly: string | null; mcp: string | null }>
  >`
    SELECT
      COALESCE(SUM(delta_usd) FILTER (WHERE created_at >= ${dayStart}), 0)   AS daily,
      COALESCE(SUM(delta_usd) FILTER (WHERE created_at >= ${monthStart}), 0) AS monthly,
      COALESCE(SUM(delta_usd) FILTER (
        WHERE created_at >= ${dayStart} AND initiated_by = 'mcp'
      ), 0) AS mcp
    FROM media_spend_events
    WHERE organization_id = ${organizationId}
  `;

  const row = rows[0] ?? { daily: '0', monthly: '0', mcp: '0' };
  return {
    dailyUsd: Number(row.daily ?? 0),
    monthlyUsd: Number(row.monthly ?? 0),
    mcpDailyUsd: Number(row.mcp ?? 0),
  };
}

export interface ReserveResult {
  holdId: string;
  heldUsd: number;
  organizationId: string;
  initiatedBy: InitiatedBy;
}

/**
 * Reserve `amountUsd` against the organisation's shared media budget.
 *
 * Locks the quota configuration row FOR UPDATE, derives current spend from the
 * event log (plus the video path's counter, which still mutates directly),
 * checks every cap, then appends the reserve event — all in one transaction.
 * Concurrent reservations serialise on the lock, so they cannot jointly breach.
 *
 * Throws QuotaExceededError when a cap would be exceeded. Nothing is written in
 * that case, so a refused request costs no bookkeeping.
 */
export async function reserveSpend(params: {
  holdId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  amountUsd: number;
  runId?: string;
  now?: Date;
}): Promise<ReserveResult> {
  const { holdId, organizationId, initiatedBy, amountUsd } = params;
  const now = params.now ?? new Date();
  const { default: prisma } = await import('@/lib/prisma');

  return prisma.$transaction(async tx => {
    // Ensure the config row exists, then take the row lock that serialises
    // concurrent reservations for this organisation.
    await tx.organizationVideoQuota.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
    const locked = await tx.$queryRaw<
      Array<{
        monthly_budget_usd: string;
        daily_budget_usd: string;
        spent_usd: string;
        spent_today_usd: string;
        period_start: Date;
        day_start: Date;
      }>
    >`
      SELECT monthly_budget_usd, daily_budget_usd, spent_usd, spent_today_usd,
             period_start, day_start
      FROM organization_video_quotas
      WHERE organization_id = ${organizationId}
      FOR UPDATE
    `;
    const config = locked[0];
    if (!config) {
      throw new Error(
        `quota configuration missing for organisation ${organizationId}`
      );
    }

    const monthlyCap = Number(config.monthly_budget_usd);
    const dailyCap = Number(config.daily_budget_usd);
    const mcpDailyCap = dailyCap * MCP_DAILY_FRACTION;

    const events = await sumWindows(tx, organizationId, now);

    // The video path still mutates the counter columns, so its spend lives
    // there. Stale windows contribute nothing (the video path resets them
    // lazily by date comparison).
    const counterDaily = isSameUtcDay(new Date(config.day_start), now)
      ? Number(config.spent_today_usd)
      : 0;
    const counterMonthly = isSameUtcMonth(new Date(config.period_start), now)
      ? Number(config.spent_usd)
      : 0;

    const dailySpend = events.dailyUsd + counterDaily;
    const monthlySpend = events.monthlyUsd + counterMonthly;

    if (monthlySpend + amountUsd > monthlyCap) {
      throw new QuotaExceededError('monthly', monthlyCap, monthlySpend);
    }
    if (dailySpend + amountUsd > dailyCap) {
      throw new QuotaExceededError('daily', dailyCap, dailySpend);
    }
    if (initiatedBy === 'mcp' && events.mcpDailyUsd + amountUsd > mcpDailyCap) {
      throw new QuotaExceededError(
        'mcp-daily',
        mcpDailyCap,
        events.mcpDailyUsd
      );
    }

    await tx.mediaSpendEvent.create({
      data: {
        eventKey: reserveKey(holdId),
        holdId,
        organizationId,
        initiatedBy,
        kind: 'reserve',
        deltaUsd: new Prisma.Decimal(amountUsd),
        runId: params.runId,
      },
    });

    return { holdId, heldUsd: amountUsd, organizationId, initiatedBy };
  });
}

/**
 * Record the ONE terminal event for a hold.
 *
 * `settle` charges the difference between what actually ran and what was
 * reserved; `release` and `sweep` return the whole reservation. All three share
 * the finalize key, so the first to land wins and any later attempt — a webhook
 * replay, a retry, or the stale sweep racing a real settlement — conflicts and
 * no-ops.
 *
 * Returns true when THIS call wrote the event, false when it was already
 * finalised. Never throws on the duplicate path: being already-finalised is
 * the success case, not an error.
 */
export async function finalizeSpend(params: {
  holdId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  heldUsd: number;
  /** Actual charge for a settle; omit for release/sweep. */
  actualUsd?: number;
  kind: 'settle' | 'release' | 'sweep';
  runId?: string;
}): Promise<boolean> {
  const { holdId, organizationId, initiatedBy, heldUsd, kind } = params;
  const deltaUsd =
    kind === 'settle'
      ? Math.round(((params.actualUsd ?? 0) - heldUsd) * 10000) / 10000
      : -heldUsd;

  const { default: prisma } = await import('@/lib/prisma');
  try {
    await prisma.mediaSpendEvent.create({
      data: {
        eventKey: finalizeKey(holdId),
        holdId,
        organizationId,
        initiatedBy,
        kind,
        deltaUsd: new Prisma.Decimal(deltaUsd),
        runId: params.runId,
      },
    });
    return true;
  } catch (error) {
    if (isDuplicateEvent(error)) {
      // Already finalised by a settle, a release, or the sweep. Idempotent by
      // construction — this is the mechanism working, not a failure.
      logger.info('media spend: hold already finalised — no-op', {
        holdId,
        attemptedKind: kind,
      });
      return false;
    }
    throw error;
  }
}

/** Read-only spend snapshot for dashboards and the MCP budget warning. */
export async function spendSnapshot(
  organizationId: string,
  now: Date = new Date()
): Promise<SpendWindows & { dailyCapUsd: number; monthlyCapUsd: number }> {
  const { default: prisma } = await import('@/lib/prisma');
  const config = await prisma.organizationVideoQuota.findUnique({
    where: { organizationId },
  });
  const windows = await prisma.$transaction(tx =>
    sumWindows(tx as TxClient, organizationId, now)
  );
  return {
    ...windows,
    dailyCapUsd: Number(config?.dailyBudgetUsd ?? 5),
    monthlyCapUsd: Number(config?.monthlyBudgetUsd ?? 25),
  };
}

/**
 * Reservations with no terminal event, older than `staleBefore`.
 *
 * A stale reserve means the settling process died. Finalising it here is safe
 * precisely because the finalize key is shared: if a real settlement lands
 * first, this sweep's insert conflicts and no-ops, so the sweep can never
 * subtract spend that actually happened — the defect the round-4 review found
 * in the previous counter-based sweep.
 */
export async function findStaleReservations(
  staleBefore: Date,
  limit = 200
): Promise<
  Array<{
    holdId: string;
    organizationId: string;
    initiatedBy: InitiatedBy;
    heldUsd: number;
  }>
> {
  const { default: prisma } = await import('@/lib/prisma');
  const rows = await prisma.$queryRaw<
    Array<{
      hold_id: string;
      organization_id: string;
      initiated_by: string;
      delta_usd: string;
    }>
  >`
    SELECT r.hold_id, r.organization_id, r.initiated_by, r.delta_usd
    FROM media_spend_events r
    WHERE r.kind = 'reserve'
      AND r.created_at < ${staleBefore}
      AND NOT EXISTS (
        SELECT 1 FROM media_spend_events f
        WHERE f.hold_id = r.hold_id AND f.kind <> 'reserve'
      )
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `;

  return rows.map(r => ({
    holdId: r.hold_id,
    organizationId: r.organization_id,
    initiatedBy: r.initiated_by as InitiatedBy,
    heldUsd: Number(r.delta_usd),
  }));
}
