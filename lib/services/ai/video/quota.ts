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
  finalizeSpend,
  spendSnapshot,
} from '@/lib/services/ai/image/spend-log';
import { InitiatedBy } from './types';

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
    runId,
  });
  return holdId;
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
  return finalizeSpend({
    holdId,
    organizationId,
    initiatedBy,
    heldUsd,
    actualUsd,
    kind: 'settle',
  });
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
