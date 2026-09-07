/**
 * GOVERNOR — receipts (SYN-1196).
 *
 * "No invisible AI — receipts on everything." Everything includes the calls
 * that never happened: a refusal writes a row too, with zero tokens, zero cost
 * and its reason in `outcome` + `provenance`. A refusal that leaves no trace is
 * indistinguishable from a call nobody made, which is exactly the ambiguity
 * this ledger exists to remove.
 *
 * Rows go to pipeline_cost_ledger — the ledger that already exists (SYN-518)
 * and that budget-enforcer already sums — rather than a parallel AI-receipts
 * table. Two ledgers would mean two totals, each of which looks affordable.
 *
 * BELT AND SUSPENDERS, in that order. lib/pipelines/track-cost.ts established
 * the pattern and the reason: emit the structured log line FIRST, so a database
 * failure cannot lose the record, then attempt the row. The Governor keeps it,
 * and it matters more here — a fail-closed refusal caused by a database error
 * is precisely the case where the database write will also fail, so the log
 * line is the only surviving evidence.
 */

import { logger } from '@/lib/logger';
import type { GovernorReceipt } from './types';

export type ReceiptDraft = Omit<GovernorReceipt, 'persisted'>;

/**
 * Emit a receipt: structured log always, ledger row best-effort.
 *
 * Never throws. A receipt failing to persist must not convert a clean refusal
 * into an exception — the caller's decision has already been made, and losing
 * the row is strictly less bad than losing the verdict.
 */
/**
 * Last line of defence for the ledger's own integrity. A NaN or negative
 * cost_usd does not just make one row wrong — it poisons every budget SUM that
 * later reads the table, and checkBudget refuses outright on a poisoned ledger,
 * so one bad write would halt a brand's AI entirely. Callers are guarded, but
 * this is the single choke point where every Governor row is written, so the
 * invariant belongs here too.
 */
function ledgerSafe(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function writeReceipt(
  draft: ReceiptDraft
): Promise<GovernorReceipt> {
  draft = {
    ...draft,
    inputTokens: ledgerSafe(draft.inputTokens),
    outputTokens: ledgerSafe(draft.outputTokens),
    costUsd: ledgerSafe(draft.costUsd),
  };
  // Belt — survives any downstream failure. Mirrors track-cost.ts's
  // 'pipeline_cost' line so existing log consumers keep working, with the
  // Governor's extra dimensions attached.

  console.info(
    JSON.stringify({
      event: 'governor_receipt',
      timestamp: new Date().toISOString(),
      pipeline_name: draft.pipelineName,
      client_id: draft.clientId,
      run_id: draft.runId,
      model: draft.model,
      provider: draft.provider,
      brand_slug: draft.brandSlug,
      runner: draft.runner,
      input_tokens: draft.inputTokens,
      output_tokens: draft.outputTokens,
      cost_usd: draft.costUsd,
      outcome: draft.outcome,
      provenance: draft.provenance,
    })
  );

  // Suspenders — the queryable row. Imported lazily so a module-load-time
  // Prisma failure can never break a caller that only needed the verdict.
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.pipelineCostLedger.create({
      data: {
        pipelineName: draft.pipelineName,
        clientId: draft.clientId,
        runId: draft.runId,
        model: draft.model,
        inputTokens: draft.inputTokens,
        outputTokens: draft.outputTokens,
        costUsd: draft.costUsd,
        provider: draft.provider,
        brandSlug: draft.brandSlug,
        runner: draft.runner,
        outcome: draft.outcome,
        provenance: draft.provenance as unknown as object,
      },
    });
    return { ...draft, persisted: true };
  } catch (error) {
    logger.error('Governor receipt did not persist — log line stands', {
      runId: draft.runId,
      outcome: draft.outcome,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { ...draft, persisted: false };
  }
}
