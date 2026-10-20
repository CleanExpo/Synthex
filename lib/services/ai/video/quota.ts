/**
 * Org media-spend quota for the VIDEO path (SYN-1115 round-6 migration).
 *
 * This module used to increment and decrement counter columns on
 * `organization_video_quotas`. That model is retired: video now reserves and
 * finalises against the SAME append-only event log the image path uses
 * (`lib/services/ai/image/spend-log.ts`).
 *
 * Two defects the migration closes, both found by independent review:
 *
 *  - **Asymmetric ceiling.** Image reservations summed the log AND the video
 *    counters, but video reservations read only the counters — so video spent
 *    as though image spend did not exist. One log means one budget, enforced
 *    identically from both sides (founder ruling R5).
 *  - **The webhook's compensating unclaim.** Settling a counter is not
 *    idempotent, so the webhook had to claim the row, mutate the quota, and
 *    unclaim on failure — a compensation that cannot tell "did not commit" from
 *    "committed but the response was lost". Finalising is keyed on the hold, so
 *    a replayed webhook conflicts on the unique index and no-ops. The
 *    compensation is deleted rather than fixed.
 *
 * The TOCTOU guarantee the previous conditional `updateMany` provided is
 * preserved: `reserveSpend` performs the cap check and the reserve insert in
 * one transaction under `SELECT ... FOR UPDATE` on the quota configuration row,
 * so concurrent reservations serialise and cannot jointly breach.
 *
 * `organization_video_quotas` is retained — it still holds the caps
 * (`monthlyBudgetUsd`, `dailyBudgetUsd`) and is the row that serialises
 * reservations. Only its mutable `spent_*` counters are out of the loop.
 */
import {
  reserveSpend,
  reserveSpendBatch,
  finalizeSpend,
  spendSnapshot,
  reserveKey,
  finalizeKey,
} from '@/lib/services/ai/image/spend-log';
import { logger } from '@/lib/logger';
import { InitiatedBy } from './types';

/** pipeline_cost_ledger.pipeline_name for video spend; run_id is the hold id. */
export const VIDEO_LEDGER_PIPELINE = 'video-generation';

/**
 * How far back the video sweep looks for a charged hold with no ledger row.
 * Covers a ledger outage of up to two days; the sweep runs every 15 minutes.
 */
export const VIDEO_LEDGER_BACKFILL_LOOKBACK_MS = 48 * 60 * 60 * 1000;

/**
 * Reserve `estimateUsd` before any provider spend.
 *
 * Returns the hold id. The caller MUST persist it (video jobs store it on
 * `video_generations.spend_hold_id`) so settlement can key off it later —
 * that link is what makes the webhook idempotent.
 *
 * Throws QuotaExceededError when a cap would be breached, writing nothing.
 */
export async function holdQuota(
  organizationId: string,
  estimateUsd: number,
  initiatedBy: InitiatedBy,
  holdId: string,
  runId?: string
): Promise<string> {
  await reserveSpend({
    holdId,
    organizationId,
    initiatedBy,
    amountUsd: estimateUsd,
    mediaType: 'video',
    runId,
  });
  return holdId;
}

/**
 * Hold one reservation PER VARIANT for a batch, admitted as a unit.
 *
 * The cap is checked once against `perVariantUsd * holdIds.length`, so a batch
 * that does not fit is refused whole rather than submitted partially — but
 * each variant then settles or releases on its own hold. A single shared hold
 * cannot express N outcomes: the log allows one terminal event per hold, so
 * the first webhook to land silenced the rest (SYN-1115 round-8).
 */
export async function holdQuotaBatch(
  organizationId: string,
  perVariantUsd: number,
  initiatedBy: InitiatedBy,
  holdIds: string[],
  runId?: string
): Promise<string[]> {
  await reserveSpendBatch({
    holdIds,
    organizationId,
    initiatedBy,
    perHoldUsd: perVariantUsd,
    mediaType: 'video',
    runId,
  });
  return holdIds;
}

/**
 * Settle a reservation to what actually ran. Idempotent: a replayed webhook
 * derives the same finalize key and no-ops.
 */
export async function settleQuota(
  organizationId: string,
  holdId: string,
  heldUsd: number,
  actualUsd: number,
  initiatedBy: InitiatedBy
): Promise<boolean> {
  const wrote = await finalizeSpend({
    holdId,
    organizationId,
    initiatedBy,
    heldUsd,
    actualUsd,
    kind: 'settle',
  });

  // One ledger for all spend (spec M10/M11): mirror the image path. The row is
  // keyed on the hold, so this runs on a replay too (finalize returns false)
  // and backfills a row an earlier settle failed to write, without adding a
  // second one. Non-fatal and after the settle: the spend log is the
  // money-safety record, the ledger is the audit record. A failure here is
  // repaired by the video sweep (backfillVideoSpendLedger), because a webhook
  // replay stops at the job's status guard and never reaches this call.
  if (actualUsd > 0) {
    try {
      // First settle: the amount and organisation are in hand, so write the row
      // directly. Replay: check the spend log and the ledger before writing.
      if (wrote) {
        await writeVideoLedgerRow(
          holdId,
          organizationId,
          actualUsd,
          new Date()
        );
      } else {
        await ensureVideoSpendLedgerRow(holdId);
      }
    } catch (error) {
      logger.error(
        'video spend: ledger write failed — the sweep backfills it',
        {
          holdId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }
  return wrote;
}

/**
 * Make sure a CHARGED video hold has its pipeline_cost_ledger row.
 *
 * Idempotent on (VIDEO_LEDGER_PIPELINE, run_id = holdId): a row already there
 * is left alone. The amount and timestamp come from the spend log, not the
 * caller — the hold's reserve plus its terminal settle/sweep event — so the
 * audit row always matches what the money-safety record charged, whichever
 * path (settle or sweep) finalised it, and lands in the budget window the
 * spend happened in. A release, an uncharged hold, a hold not yet finalised
 * or a non-video hold writes nothing.
 *
 * Throws when a read or the write fails; callers decide whether that is fatal.
 * The check-then-insert is not atomic (the ledger has no unique key on
 * run_id): two concurrent calls for one hold could both write. A duplicate
 * row is the lesser evil next to a missing one, and the callers are a webhook
 * already serialised by its job's status guard and a single cron sweep.
 */
export async function ensureVideoSpendLedgerRow(
  holdId: string
): Promise<'written' | 'present' | 'not_charged'> {
  const { default: prisma } = await import('@/lib/prisma');
  const [reserve, final] = await Promise.all([
    prisma.mediaSpendEvent.findUnique({
      where: { eventKey: reserveKey(holdId) },
      select: { deltaUsd: true, organizationId: true, mediaType: true },
    }),
    prisma.mediaSpendEvent.findUnique({
      where: { eventKey: finalizeKey(holdId) },
      select: { kind: true, deltaUsd: true, createdAt: true },
    }),
  ]);
  if (
    !reserve ||
    !final ||
    final.kind === 'release' ||
    (reserve.mediaType !== null && reserve.mediaType !== 'video')
  ) {
    return 'not_charged';
  }

  // finalizeSpend stores actual - held, so held + that delta is the charge.
  const actualUsd =
    Math.round((Number(reserve.deltaUsd) + Number(final.deltaUsd)) * 10000) /
    10000;
  if (!(actualUsd > 0)) return 'not_charged';

  const existing = await prisma.pipelineCostLedger.findFirst({
    where: { pipelineName: VIDEO_LEDGER_PIPELINE, runId: holdId },
    select: { id: true },
  });
  if (existing) return 'present';

  await writeVideoLedgerRow(
    holdId,
    reserve.organizationId,
    actualUsd,
    final.createdAt
  );
  logger.info('video spend: ledger row written', {
    holdId,
    costUsd: actualUsd,
    finalisedBy: final.kind,
  });
  return 'written';
}

/** Write one video pipeline_cost_ledger row. Throws when the write fails. */
async function writeVideoLedgerRow(
  holdId: string,
  organizationId: string,
  costUsd: number,
  createdAt: Date
): Promise<void> {
  const { default: prisma } = await import('@/lib/prisma');
  await prisma.pipelineCostLedger.create({
    data: {
      pipelineName: VIDEO_LEDGER_PIPELINE,
      clientId: organizationId,
      runId: holdId,
      // Per-model identity lives on video_generations; the ledger keys on the run.
      model: 'fal-video',
      // Video is billed per second, not tokens; the columns are NOT NULL.
      inputTokens: 0,
      outputTokens: 0,
      costUsd,
      createdAt,
    },
  });
}

/**
 * Durable repair for a ledger write that failed after its spend was settled.
 * Finds video holds finalised since `since` with a positive charge and no
 * ledger row, and writes each one. Run by the video sweep every pass; a hold
 * whose write fails again is simply found again next pass.
 *
 * Returns the number of rows written.
 */
export async function backfillVideoSpendLedger(
  since: Date,
  limit = 200
): Promise<number> {
  const { default: prisma } = await import('@/lib/prisma');
  const rows = await prisma.$queryRaw<Array<{ hold_id: string }>>`
    SELECT f.hold_id
    FROM media_spend_events f
    JOIN media_spend_events r
      ON r.hold_id = f.hold_id AND r.kind = 'reserve'
    WHERE f.kind IN ('settle', 'sweep')
      AND f.created_at >= ${since}
      AND r.media_type = 'video'
      AND r.delta_usd + f.delta_usd > 0
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_cost_ledger l
        WHERE l.pipeline_name = ${VIDEO_LEDGER_PIPELINE}
          AND l.run_id = f.hold_id
      )
    ORDER BY f.created_at ASC
    LIMIT ${limit}
  `;

  let written = 0;
  for (const { hold_id: holdId } of rows) {
    try {
      if ((await ensureVideoSpendLedgerRow(holdId)) === 'written') written++;
    } catch (error) {
      logger.error('video spend: ledger backfill failed — retrying next pass', {
        holdId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (written > 0) {
    logger.warn('video spend: backfilled missing ledger rows', {
      count: written,
    });
  }
  return written;
}

/**
 * Return a whole reservation (failed job). Shares the finalize key with
 * settlement and the sweep, so only the first of the three ever stands.
 */
export async function releaseQuota(
  organizationId: string,
  holdId: string,
  heldUsd: number,
  initiatedBy: InitiatedBy
): Promise<boolean> {
  return finalizeSpend({
    holdId,
    organizationId,
    initiatedBy,
    heldUsd,
    kind: 'release',
  });
}

/** Read-only snapshot for the UI banner / MCP budgetWarning (>=80% of a cap). */
export async function quotaSnapshot(organizationId: string) {
  const snap = await spendSnapshot(organizationId);
  return {
    spentUsd: snap.monthlyUsd,
    monthlyBudgetUsd: snap.monthlyCapUsd,
    spentTodayUsd: snap.dailyUsd,
    dailyBudgetUsd: snap.dailyCapUsd,
    warning:
      snap.monthlyUsd >= 0.8 * snap.monthlyCapUsd ||
      snap.dailyUsd >= 0.8 * snap.dailyCapUsd,
  };
}
