/**
 * GOVERNOR — per-build spending cap (founder decision, 22/10/2026).
 *
 * A client build is metered at about US$80, and the DIRECT spend inside one
 * build (AI models, image/video, paid APIs) must stay at or under US$10-12.
 * This module is that ceiling, as a cost cap on the existing Governor. It is
 * internal cost control, not billing: nothing here prices, invoices or
 * charges anyone.
 *
 * IDENTITY. A build is a `buildId`, and the Governor writes it as the
 * pipeline_cost_ledger run_id of every governed call in that build. "What has
 * this build spent" is therefore one SUM(cost_usd) WHERE run_id = buildId —
 * no schema change, no second ledger.
 *
 * CURRENCY. The cap is in USD, because pipeline_cost_ledger.cost_usd is USD.
 * The founder thinks in AUD for client economics; converting a build's USD
 * spend to AUD is a later reporting concern and deliberately NOT done here,
 * so no exchange rate can loosen or tighten the ceiling.
 *
 * FAIL-CLOSED, like budget.ts. An unreadable sum, a poisoned sum (NaN,
 * negative, Infinity), an unusable estimate or an unusable cap each REFUSE.
 * `spent + estimate > cap` is FALSE under IEEE semantics for NaN and for a
 * large negative estimate, so every operand passes asUsableUsd first.
 *
 * KNOWN LIMITS (disclosed, not hidden):
 *   - Read-then-decide, not a reservation — the same race budget.ts documents.
 *     Concurrent calls in one build can each see the same pre-spend total and
 *     together overshoot by up to one estimate per concurrent caller.
 *   - The cap is checked against the ESTIMATE; the receipt records the actual
 *     cost. A call that runs over its estimate can take the build over the cap
 *     by that difference; the NEXT call in the build is then refused.
 *   - Only spend recorded under run_id = buildId is counted. Paths that write
 *     the ledger under their own run_id (the P5 media holds use run_id =
 *     holdId as their idempotency key) are not counted until they record the
 *     buildId too.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { GovernorOutcome } from './types';

/** Default per-build cap in USD, when SYNTHEX_BUILD_CAP_USD is unset. */
export const DEFAULT_BUILD_CAP_USD = 12;

/** Opt-in on a governed call: put this call inside a capped build. */
export interface GovernedBuild {
  /** Becomes the ledger run_id of every governed call in the build. */
  buildId: string;
  /** USD. Absent means SYNTHEX_BUILD_CAP_USD, else DEFAULT_BUILD_CAP_USD. */
  capUsd?: number;
}

export interface BuildCapDetail {
  buildId: string;
  verdict: string;
  spentUsd: number | null;
  estimatedCostUsd: number | null;
  capUsd: number | null;
}

export interface BuildCapDecision {
  allowed: boolean;
  verdict: string;
  outcome: GovernorOutcome | null;
  detail: BuildCapDetail;
}

export interface BuildSpend {
  buildId: string;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
}

/** Thrown by getBuildSpend: an unknown spend must never read as zero. */
export class BuildSpendUnreadableError extends Error {
  constructor(
    readonly buildId: string,
    readonly reason: string
  ) {
    super(`Build spend for ${buildId} is unreadable: ${reason}`);
    this.name = 'BuildSpendUnreadableError';
  }
}

/** The same gate as budget.ts: finite and non-negative, or nothing. */
function asUsableUsd(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function isUsableBuildId(buildId: unknown): buildId is string {
  return typeof buildId === 'string' && buildId.trim().length > 0;
}

/**
 * The cap that applies: an explicit capUsd, else SYNTHEX_BUILD_CAP_USD, else
 * DEFAULT_BUILD_CAP_USD. Returns null when the value that applies is unusable
 * — a mistyped env var refuses spend rather than silently becoming US$12.
 */
export function resolveBuildCapUsd(
  capUsd?: number,
  env: NodeJS.ProcessEnv = process.env
): number | null {
  if (capUsd !== undefined) return asUsableUsd(capUsd);
  const raw = env.SYNTHEX_BUILD_CAP_USD;
  if (raw === undefined || raw.trim() === '') return DEFAULT_BUILD_CAP_USD;
  return asUsableUsd(Number(raw));
}

type SpendRead =
  | { ok: true; spentUsd: number }
  | { ok: false; kind: 'read_failed' | 'unusable'; reason: string };

/** SUM(cost_usd) for run_id = buildId. A build with no rows has spent 0. */
async function readBuildSpend(buildId: string): Promise<SpendRead> {
  let rawSpent: unknown;
  try {
    const aggregate = await prisma.pipelineCostLedger.aggregate({
      where: { runId: buildId },
      _sum: { costUsd: true },
    });
    rawSpent = aggregate?._sum?.costUsd ?? 0;
  } catch (error) {
    return {
      ok: false,
      kind: 'read_failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  if (asUsableUsd(rawSpent) === null) {
    return {
      ok: false,
      kind: 'unusable',
      reason: `ledger sum is not a usable amount: ${String(rawSpent)}`,
    };
  }
  return { ok: true, spentUsd: rawSpent as number };
}

/**
 * Decide whether `estimatedCostUsd` fits in what is left of the build's cap.
 * Spend that lands exactly on the cap is allowed ("at or under").
 */
export async function checkBuildCap(
  build: GovernedBuild,
  estimatedCostUsd: number
): Promise<BuildCapDecision> {
  const buildId = String(build?.buildId ?? '');
  const refuse = (
    verdict: string,
    outcome: GovernorOutcome,
    detail: Partial<BuildCapDetail> = {}
  ): BuildCapDecision => ({
    allowed: false,
    verdict,
    outcome,
    detail: {
      buildId,
      verdict,
      spentUsd: null,
      estimatedCostUsd: null,
      capUsd: null,
      ...detail,
    },
  });

  if (!isUsableBuildId(build?.buildId)) {
    return refuse(
      'budget_untrusted_input:build_id_invalid',
      'refused_budget_untrusted_input'
    );
  }

  if (asUsableUsd(estimatedCostUsd) === null) {
    logger.error('Governor build-cap estimate invalid — refusing', {
      buildId,
      estimatedCostUsd: String(estimatedCostUsd),
    });
    return refuse(
      'build_cap_invalid_estimate',
      'refused_budget_invalid_estimate'
    );
  }

  const capUsd = resolveBuildCapUsd(build.capUsd);
  if (capUsd === null) {
    logger.error('Governor build cap is not a usable amount — refusing', {
      buildId,
    });
    return refuse(
      'budget_untrusted_input:build_cap_unusable',
      'refused_budget_untrusted_input',
      { estimatedCostUsd }
    );
  }

  const read = await readBuildSpend(buildId);
  if (!read.ok) {
    logger.error('Governor build spend unreadable — refusing (fail-closed)', {
      buildId,
      kind: read.kind,
      reason: read.reason,
    });
    return read.kind === 'read_failed'
      ? refuse('build_spend_read_failed', 'refused_control_plane_error', {
          estimatedCostUsd,
          capUsd,
        })
      : refuse(
          'budget_untrusted_input:build_spend_unusable',
          'refused_budget_untrusted_input',
          { estimatedCostUsd, capUsd }
        );
  }

  // Both operands have passed the gate, so the sum is finite or +Infinity
  // (overflow), and +Infinity > cap refuses — no third guard needed.
  const spentUsd = read.spentUsd;
  const detail = {
    buildId,
    spentUsd: Number(spentUsd.toFixed(6)),
    estimatedCostUsd,
    capUsd,
  };

  if (spentUsd + estimatedCostUsd > capUsd) {
    const verdict = `build_cap_exceeded:spent=${detail.spentUsd}:cap=${capUsd}`;
    return {
      allowed: false,
      verdict,
      outcome: 'refused_build_cap_exceeded',
      detail: { ...detail, verdict },
    };
  }

  return {
    allowed: true,
    verdict: 'within_build_cap',
    outcome: null,
    detail: { ...detail, verdict: 'within_build_cap' },
  };
}

/**
 * Read helper for later UI/reporting: what a build has spent against its cap.
 * Throws BuildSpendUnreadableError rather than returning a zero it cannot
 * stand behind — a failed read must never look like an empty build.
 */
export async function getBuildSpend(
  buildId: string,
  capUsd?: number
): Promise<BuildSpend> {
  if (!isUsableBuildId(buildId)) {
    throw new BuildSpendUnreadableError(String(buildId), 'invalid buildId');
  }
  const cap = resolveBuildCapUsd(capUsd);
  if (cap === null) {
    throw new BuildSpendUnreadableError(buildId, 'cap is not a usable amount');
  }
  const read = await readBuildSpend(buildId);
  if (!read.ok) throw new BuildSpendUnreadableError(buildId, read.reason);
  const spentUsd = Number(read.spentUsd.toFixed(6));
  return {
    buildId,
    spentUsd,
    capUsd: cap,
    remainingUsd: Math.max(0, Number((cap - spentUsd).toFixed(6))),
  };
}
