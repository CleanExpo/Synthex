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
 * BOTH media types reserve through this log (round-6 migration), so one
 * organisation has exactly one budget enforced identically from both sides
 * (founder ruling R5). The previous mixed model — log for image, counters for
 * video — enforced the shared cap only when an image reserved, so video could
 * spend as though image spend did not exist.
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

/**
 * THE attempt key for one video generation job (SYN-1115 round-8 fix).
 *
 * Submit and the completion webhook are separate processes recording the SAME
 * paid call, so they must derive the same key or the call is counted twice.
 * They previously did not: submit keyed on the batch index and the webhook on
 * the provider job id, so every video generation wrote two attempt rows and
 * doubled its recorded spend.
 *
 * `providerJobId` is the only identifier BOTH sides hold — submit receives it
 * from fal, the webhook reads it off the row — so it is the key, and this
 * single derivation is exported so the two call sites cannot drift again.
 */
export function videoAttemptKey(holdId: string, providerJobId: string): string {
  // A blank id would derive the SAME key for every variant of a batch, so the
  // second paid call would upsert the first's row and under-record spend. The
  // index-based key this replaced could not collide that way, so refusing here
  // is what keeps the replacement strictly safer rather than a trade.
  if (typeof providerJobId !== 'string' || providerJobId.trim() === '') {
    throw new Error(
      `videoAttemptKey requires a provider job id (hold ${holdId}) — a blank ` +
        `id would collapse distinct paid calls onto one attempt`
    );
  }
  // The `job:` segment keeps provider ids in their OWN namespace. Without it a
  // provider free to return any string could return one shaped like the
  // synthetic key below — `unaddressable:1` — and collapse two paid calls onto
  // one row. fal's ids look like UUIDs today but nothing guarantees the format,
  // so the namespaces are separated structurally rather than by assumption.
  return `${holdId}:video:job:${providerJobId}`;
}

/**
 * Key for a submit the provider ACCEPTED but could not address (2xx with no
 * usable job id). There is no provider id to key on, so the variant index
 * stands in — unique within the batch, and in a namespace no provider id can
 * reach because real keys always carry the `job:` segment.
 */
export function unaddressableAttemptKey(
  holdId: string,
  variant: number
): string {
  return `${holdId}:video:unaddressable:${variant}`;
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
 *
 * Filters on `window_at` (the hold's RESERVE instant), never on each event's
 * own `created_at`. Filtering by event time is wrong at a boundary: a hold
 * reserved at 23:59 for +$0.42 and settled at 00:01 for -$0.315 would make day
 * 1 over-count by the unspent remainder and day 2 sum to NEGATIVE $0.315.
 * Attributing both events to the reserve instant means a hold lands wholly in
 * one window and that window nets to exactly what it cost.
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
      COALESCE(SUM(delta_usd) FILTER (WHERE window_at >= ${dayStart}), 0)   AS daily,
      COALESCE(SUM(delta_usd) FILTER (WHERE window_at >= ${monthStart}), 0) AS monthly,
      COALESCE(SUM(delta_usd) FILTER (
        WHERE window_at >= ${dayStart} AND initiated_by = 'mcp'
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
  mediaType?: 'image' | 'video';
  runId?: string;
  now?: Date;
}): Promise<ReserveResult> {
  const [only] = await reserveSpendBatch({
    holdIds: [params.holdId],
    organizationId: params.organizationId,
    initiatedBy: params.initiatedBy,
    perHoldUsd: params.amountUsd,
    mediaType: params.mediaType ?? 'image',
    runId: params.runId,
    now: params.now,
  });
  return only;
}

/**
 * Reserve `perHoldUsd` under EACH of `holdIds`, all-or-nothing.
 *
 * A batch of video variants is one cap decision but N independent outcomes:
 * each variant succeeds, fails or is swept on its own, and the log allows
 * exactly ONE terminal event per hold. Sharing a hold across the batch
 * therefore makes those outcomes mutually exclusive — the first webhook to
 * land wins and the rest become duplicate-key no-ops (SYN-1115 round-8).
 *
 * So the cap is checked ONCE against the total, preserving the all-or-nothing
 * admission the caller relies on (a batch that does not fit is refused whole,
 * not submitted partially), while each variant gets its own hold and can be
 * settled or released independently.
 */
export async function reserveSpendBatch(params: {
  holdIds: string[];
  organizationId: string;
  initiatedBy: InitiatedBy;
  perHoldUsd: number;
  /**
   * What the hold is for. Recorded on the reserve event so the stale sweep can
   * tell an IMAGE hold — which never has an owner row, because image
   * generation is synchronous — from a VIDEO hold stranded before its row was
   * created. Settling both at zero forgot real spend and returned the
   * headroom (release review, pass 2).
   */
  mediaType: 'image' | 'video';
  runId?: string;
  now?: Date;
}): Promise<ReserveResult[]> {
  const { holdIds, organizationId, initiatedBy, perHoldUsd } = params;
  if (holdIds.length === 0) return [];
  if (new Set(holdIds).size !== holdIds.length) {
    // Duplicates would collide on the reserve key and silently reserve less
    // than the cap check just admitted.
    throw new Error('reserveSpendBatch: hold ids must be unique');
  }
  const amountUsd = Math.round(perHoldUsd * holdIds.length * 10000) / 10000;
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

    // Both media types now reserve through this log (SYN-1115 round-6), so the
    // log IS the spend. The legacy counter columns are no longer read: leaving
    // them in the sum would double-count historical video spend that has
    // already rolled out of its window, and the asymmetry where video ignored
    // image spend is exactly what this migration removes.
    const dailySpend = events.dailyUsd;
    const monthlySpend = events.monthlyUsd;

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

    // One reserve event per hold, inside the same transaction as the cap
    // check, so the batch is admitted or refused as a unit.
    await tx.mediaSpendEvent.createMany({
      data: holdIds.map(holdId => ({
        eventKey: reserveKey(holdId),
        holdId,
        organizationId,
        initiatedBy,
        kind: 'reserve' as const,
        deltaUsd: new Prisma.Decimal(perHoldUsd),
        windowAt: now,
        mediaType: params.mediaType,
        runId: params.runId,
      })),
    });

    return holdIds.map(holdId => ({
      holdId,
      heldUsd: perHoldUsd,
      organizationId,
      initiatedBy,
    }));
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
  // A sweep now carries an actual too (derived from provider attempts), so it
  // charges a run that paid and then died instead of writing it off. Only a
  // release — an outcome we KNOW produced nothing — returns the whole hold.
  const deltaUsd =
    kind === 'release'
      ? -heldUsd
      : Math.round(((params.actualUsd ?? 0) - heldUsd) * 10000) / 10000;

  const { default: prisma } = await import('@/lib/prisma');

  // The finalize inherits the reserve's window so the pair nets inside one
  // window. Resolved from the log rather than passed in, so no caller can get
  // it wrong and a sweep (which never saw the original request) is correct too.
  const reserve = await prisma.mediaSpendEvent.findUnique({
    where: { eventKey: reserveKey(holdId) },
    select: { windowAt: true },
  });
  if (!reserve) {
    // Finalising something never reserved would fabricate negative spend.
    logger.error('media spend: finalize for an unknown reservation — ignored', {
      holdId,
      kind,
    });
    return false;
  }

  try {
    await prisma.mediaSpendEvent.create({
      data: {
        eventKey: finalizeKey(holdId),
        holdId,
        organizationId,
        initiatedBy,
        kind,
        deltaUsd: new Prisma.Decimal(deltaUsd),
        windowAt: reserve.windowAt,
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

// ---------------------------------------------------------------------------
// Provider attempts — the record of what was ACTUALLY charged (round-7)
// ---------------------------------------------------------------------------

export interface RecordAttemptParams {
  /** Deterministic per call site, so a retried handler records once. */
  attemptKey: string;
  holdId: string;
  organizationId: string;
  mediaType: 'image' | 'video';
  provider: string;
  modelId: string;
  status?: 'submitted' | 'succeeded' | 'failed';
  costUsd?: number | null;
  outputWidth?: number;
  outputHeight?: number;
  inputImageCount?: number;
  providerJobId?: string;
}

/**
 * Record that a paid provider call was made.
 *
 * Called BEFORE or immediately after the request leaves, with
 * `status: 'submitted'` and a null cost when the outcome is not yet known. A
 * null cost is not "free" — it means "this may have been billed", and both the
 * sweep and settlement treat it as spend at the reservation's own rate rather
 * than writing it off.
 *
 * Idempotent on `attemptKey`: a replayed handler updates the existing row
 * instead of inflating spend with a duplicate.
 */
export async function recordAttempt(
  params: RecordAttemptParams
): Promise<void> {
  const { default: prisma } = await import('@/lib/prisma');

  // The attempt inherits its reservation's window so it aggregates with it.
  const reserve = await prisma.mediaSpendEvent.findUnique({
    where: { eventKey: reserveKey(params.holdId) },
    select: { windowAt: true },
  });
  if (!reserve) {
    logger.error('media spend: attempt for an unknown reservation — ignored', {
      holdId: params.holdId,
      attemptKey: params.attemptKey,
    });
    return;
  }

  const data = {
    holdId: params.holdId,
    organizationId: params.organizationId,
    mediaType: params.mediaType,
    provider: params.provider,
    modelId: params.modelId,
    status: params.status ?? 'submitted',
    costUsd:
      params.costUsd === undefined || params.costUsd === null
        ? null
        : new Prisma.Decimal(params.costUsd),
    outputWidth: params.outputWidth,
    outputHeight: params.outputHeight,
    inputImageCount: params.inputImageCount ?? 0,
    providerJobId: params.providerJobId,
    windowAt: reserve.windowAt,
  };

  await prisma.mediaProviderAttempt.upsert({
    where: { attemptKey: params.attemptKey },
    create: { attemptKey: params.attemptKey, ...data },
    update: {
      status: data.status,
      costUsd: data.costUsd,
      outputWidth: data.outputWidth,
      outputHeight: data.outputHeight,
      inputImageCount: data.inputImageCount,
      providerJobId: data.providerJobId,
    },
  });
}

export interface AttemptTotals {
  /** Attempts recorded against this hold. */
  count: number;
  /** Sum of known costs. */
  knownCostUsd: number;
  /** Attempts whose cost is not yet known — possibly billed. */
  unknownCount: number;
}

/** What a hold has actually cost so far, according to its attempts. */
export async function attemptTotals(holdId: string): Promise<AttemptTotals> {
  const { default: prisma } = await import('@/lib/prisma');
  const rows = await prisma.mediaProviderAttempt.findMany({
    where: { holdId },
    select: { costUsd: true },
  });
  return {
    count: rows.length,
    knownCostUsd:
      Math.round(
        rows.reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0) * 10000
      ) / 10000,
    unknownCount: rows.filter(r => r.costUsd === null).length,
  };
}

/**
 * The amount a hold should settle at, DERIVED from its attempts.
 *
 * - All costs known    -> their sum, including every retry and fallback that
 *                         the previous "final result only" settlement hid.
 * - Any cost unknown   -> the sum PLUS the reservation's own rate for each
 *                         unknown, because an attempt that may have been billed
 *                         must not be written off. Erring high is the safe
 *                         direction; the alternative under-reports real money.
 *
 * ## `knownAttemptCount` — why absence of evidence is not evidence of absence
 *
 * This used to read `if (totals.count === 0) return 0`, on the reasoning that
 * no attempts means nothing reached a provider. That is sound only if attempt
 * persistence is guaranteed, and it is not: `recordAttempt` is best-effort at
 * every call site, wrapped in a try/catch so a bookkeeping failure cannot
 * destroy a generation the caller already paid for. So "no rows" was ambiguous
 * between NOTHING WAS SUBMITTED and WE FAILED TO WRITE IT DOWN, and the rule
 * resolved that ambiguity in the direction that erases real money — an image
 * batch that generated every variant settled at $0 if its attempt writes were
 * lost (SYN-1115 round-8).
 *
 * The caller knows something the table cannot: how many provider calls it
 * actually made. Passing that as `knownAttemptCount` makes it a FLOOR. Database
 * evidence may only revise the charge UPWARD — a retry the caller never saw
 * still counts — never below what the caller proved. Absence of evidence stops
 * meaning absence of spend, without giving up the richer evidence when it is
 * there.
 *
 * A hold that genuinely never reached a provider passes 0 and still settles at
 * 0, so this fails closed on lost evidence rather than over-charging every run.
 */
export async function settlementAmountUsd(
  holdId: string,
  fallbackPerAttemptUsd: number,
  claimed: number | ReadonlySet<string> = 0,
  /**
   * What to charge when there is NO evidence at all — no attempt row and no
   * claimed call. Defaults to 0, which is right whenever absence is provable
   * (a video job that never got a provider job id). A caller that cannot prove
   * absence passes the reservation instead, so an abandoned hold errs high
   * rather than being written off.
   *
   * This only applies when the log is genuinely empty. Surviving attempt rows
   * are ALWAYS authoritative — a caller cannot use this to override evidence.
   */
  noEvidenceUsd = 0
): Promise<number> {
  const { default: prisma } = await import('@/lib/prisma');
  const rows = await prisma.mediaProviderAttempt.findMany({
    where: { holdId },
    select: { attemptKey: true, costUsd: true },
  });

  // Recorded evidence: a known cost counts as itself, an unknown one at the
  // reservation rate because it may have been billed. A row recorded at a
  // KNOWN ZERO — a preflight that provably sent nothing — contributes nothing.
  const recorded = new Set<string>();
  let total = 0;
  for (const row of rows) {
    recorded.add(row.attemptKey);
    total += row.costUsd === null ? fallbackPerAttemptUsd : Number(row.costUsd);
  }

  // Calls the caller claims it made that left NO row. Joined on attempt key,
  // not by subtracting set sizes.
  //
  // Counting was wrong and this is the second defect it caused. Sizes only
  // correspond if every recorded row belongs to a claimed call, and the
  // preflight fix deliberately breaks that: a retracted zero-cost row exists
  // and is NOT claimed, so `claimed - rowCount` let that row absorb the floor
  // of a DIFFERENT paid call whose write was lost, erasing it. Matching
  // identities cannot make that mistake.
  const claimedCount =
    typeof claimed === 'number'
      ? Math.max(0, claimed - rows.length)
      : Array.from(claimed).filter(key => !recorded.has(key)).length;
  total += claimedCount * fallbackPerAttemptUsd;

  if (rows.length === 0 && claimedCount === 0) return noEvidenceUsd;
  return Math.round(total * 10000) / 10000;
}

/**
 * Reservations that are provably DEAD and still unterminated.
 *
 * "Old" is not evidence. The previous version selected on age alone, which
 * meant a generation still in flight past the cutoff got swept first; the
 * genuine settlement then hit the shared finalize key and no-opped, so a paid
 * call recorded ZERO. That traded round-4's double-subtract for an erase, which
 * is worse — it under-reports real money.
 *
 * A reservation qualifies only when BOTH hold:
 *
 *   1. it is older than `staleBefore`, AND
 *   2. nothing that could still settle it is alive:
 *      - a linked video job (video_generations.spend_hold_id) must be in a
 *        TERMINAL state, or absent entirely. A job still 'generating' is a live
 *        owner and its webhook — or the video sweep that precedes this — will
 *        settle it.
 *      - an image reservation has no linked row by design (image generation is
 *        synchronous), so its liveness bound is the request itself. Callers
 *        pass a `staleBefore` far beyond `maxDuration`, so an image reserve
 *        older than that cannot have a running request behind it.
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
    /**
     * A linked video job carries a provider job id, so fal accepted a submit
     * for this hold — independent of whether the attempt row survived. Lets
     * the sweep charge a call it can PROVE happened rather than reading an
     * empty attempt table as "nothing was submitted" (SYN-1115 round-8).
     */
    submittedToProvider: boolean;
    /**
     * Whether ANY row owns this hold. An image reservation never has one —
     * image generation is synchronous and settles in-process — so for image
     * holds `submittedToProvider` is false for want of a link, not because
     * nothing was submitted. The sweep needs to tell those apart: no owner row
     * means no proof in either direction (SYN-1115 round-8).
     */
    hasOwnerRow: boolean;
    /** 'image' | 'video', or null for holds reserved before the column existed. */
    mediaType: string | null;
  }>
> {
  const { default: prisma } = await import('@/lib/prisma');
  const rows = await prisma.$queryRaw<
    Array<{
      hold_id: string;
      organization_id: string;
      initiated_by: string;
      delta_usd: string;
      submitted_to_provider: boolean;
      has_owner_row: boolean;
      media_type: string | null;
    }>
  >`
    SELECT r.hold_id, r.organization_id, r.initiated_by, r.delta_usd,
           r.media_type,
           EXISTS (
             SELECT 1 FROM video_generations v
             WHERE v.spend_hold_id = r.hold_id
               AND v.provider_job_id IS NOT NULL
           ) AS submitted_to_provider,
           EXISTS (
             SELECT 1 FROM video_generations v
             WHERE v.spend_hold_id = r.hold_id
           ) AS has_owner_row
    FROM media_spend_events r
    WHERE r.kind = 'reserve'
      AND r.created_at < ${staleBefore}
      -- not already finalised by settle, release or an earlier sweep
      AND NOT EXISTS (
        SELECT 1 FROM media_spend_events f
        WHERE f.hold_id = r.hold_id AND f.kind <> 'reserve'
      )
      -- and no LIVE owner that could still settle it
      AND NOT EXISTS (
        SELECT 1 FROM video_generations v
        WHERE v.spend_hold_id = r.hold_id
          AND v.status = 'generating'
      )
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `;

  return rows.map(r => ({
    holdId: r.hold_id,
    organizationId: r.organization_id,
    initiatedBy: r.initiated_by as InitiatedBy,
    heldUsd: Number(r.delta_usd),
    submittedToProvider: Boolean(r.submitted_to_provider),
    hasOwnerRow: Boolean(r.has_owner_row),
    mediaType: r.media_type,
  }));
}
