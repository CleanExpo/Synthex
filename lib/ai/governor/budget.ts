/**
 * GOVERNOR — per-brand budget across all four providers (SYN-1196).
 *
 * Spend is read from pipeline_cost_ledger, the ledger that already exists
 * (SYN-518) and that lib/ai/budget-enforcer.ts already sums. The Governor
 * writes its receipts with `clientId = organizationId`, which is the same
 * dimension budget-enforcer sums over, so Governor spend and legacy pipeline
 * spend land in ONE total rather than two that each look affordable.
 *
 * Two deliberate differences from budget-enforcer.ts:
 *
 *   1. FAIL-CLOSED. budget-enforcer documents a fail-open doctrine so a deploy
 *      that outruns its migration cannot break generation. The Governor path
 *      is new and opt-in (RunnerFlag defaults OFF), so it has no such deploy
 *      risk to trade against — a ledger or policy read error refuses.
 *   2. enforcementMode is NOT consulted. On the legacy path 'log_only' exists
 *      so an org can be observed before it is constrained. On the Governor
 *      path a ceiling is a ceiling: a brand only reaches this code because
 *      someone explicitly enabled a runner for it. The mode is still recorded
 *      in provenance so the difference is visible in the receipt.
 *
 * NO BUDGET MEANS NO SPENDING. An org with no OrgBudgetPolicy row is refused
 * (`refused_budget_unconfigured`), not waved through. Unbounded spend is not a
 * safe default for a system whose whole purpose is to bound spend.
 *
 * KNOWN LIMIT — this check is read-then-decide, not a reservation. Two calls
 * arriving concurrently just under the ceiling can both observe the same
 * pre-spend total and both proceed, overshooting by at most one call's
 * estimate per concurrent caller. Closing that needs the atomic Redis
 * INCRBY-then-check reservation budget-enforcer.ts already implements; the
 * Governor deliberately does not build a second one. Where exactness matters,
 * the two layers compose — budget-enforcer still runs on the orchestration
 * seams it owns.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { GovernorOutcome, GovernorProvider } from './types';

export interface BudgetDecision {
  allowed: boolean;
  verdict: string;
  outcome: GovernorOutcome | null;
  detail: {
    windowSpendUsd: number;
    estimatedCostUsd: number;
    orgDailyCeilingUsd: number | null;
    providerDailyCeilingUsd: number | null;
  };
}

/** Start of the current UTC day — the same window budget-enforcer uses. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Read a per-provider ceiling out of OrgBudgetPolicy.providerDailyCeilingsUsd.
 * The column is Json, so its contents are untrusted: anything that is not a
 * finite non-negative number is treated as "no ceiling set", never coerced.
 */
export function readProviderCeiling(
  raw: unknown,
  provider: GovernorProvider
): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[provider];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

const EMPTY_DETAIL = {
  windowSpendUsd: 0,
  estimatedCostUsd: 0,
  orgDailyCeilingUsd: null,
  providerDailyCeilingUsd: null,
};

/**
 * Decide whether `estimatedCostUsd` fits under the brand's remaining daily
 * budget, for both the org-wide ceiling and this provider's own ceiling.
 */
export async function checkBudget(
  organizationId: string,
  provider: GovernorProvider,
  estimatedCostUsd: number,
  now: Date = new Date()
): Promise<BudgetDecision> {
  // GUARD THE INPUT BEFORE COMPARING IT. Every ceiling test below is of the
  // form `spend + estimate > ceiling`, and under IEEE semantics that predicate
  // is FALSE for NaN and for a sufficiently negative estimate — so an
  // unguarded comparison returns allowed:true on a budget that is already
  // exhausted. A caller passing NaN or negative token counts could reopen a
  // spent budget at will. (Independent review, cursor lane, round 3, finding
  // P1-BUDGET-NEGATIVE-NAN-ESTIMATE-BYPASS: with $5.00 spent against a $1.00
  // ceiling, estimate 0 refused, estimate -1000 and NaN both allowed.)
  //
  // Note this is NOT the disclosed read-then-decide race, and not an ordinary
  // underestimate: a zero estimate still refuses once spend >= ceiling.
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
    logger.error('Governor budget estimate invalid — refusing (fail-closed)', {
      organizationId,
      provider,
      estimatedCostUsd: String(estimatedCostUsd),
    });
    return {
      allowed: false,
      verdict: 'budget_invalid_estimate',
      outcome: 'refused_budget_invalid_estimate',
      detail: { ...EMPTY_DETAIL, estimatedCostUsd: 0 },
    };
  }

  let policy;
  let spendRows;

  try {
    [policy, spendRows] = await Promise.all([
      prisma.orgBudgetPolicy.findUnique({
        where: { organizationId },
        select: {
          dailyCeilingUsd: true,
          providerDailyCeilingsUsd: true,
          enforcementMode: true,
        },
      }),
      prisma.pipelineCostLedger.groupBy({
        by: ['provider'],
        where: {
          clientId: organizationId,
          createdAt: { gte: startOfUtcDay(now) },
        },
        _sum: { costUsd: true },
      }),
    ]);
  } catch (error) {
    logger.error('Governor budget read failed — refusing (fail-closed)', {
      organizationId,
      provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      allowed: false,
      verdict: 'control_plane_error',
      outcome: 'refused_control_plane_error',
      detail: { ...EMPTY_DETAIL, estimatedCostUsd },
    };
  }

  if (!policy) {
    return {
      allowed: false,
      verdict: 'budget_unconfigured',
      outcome: 'refused_budget_unconfigured',
      detail: { ...EMPTY_DETAIL, estimatedCostUsd },
    };
  }

  const rows = Array.isArray(spendRows) ? spendRows : [];
  // Pre-SYN-1196 rows carry provider = null; they belong in the org total.
  const orgSpendUsd = rows.reduce(
    (total, row) => total + (row._sum?.costUsd ?? 0),
    0
  );
  const providerSpendUsd = rows
    .filter(row => row.provider === provider)
    .reduce((total, row) => total + (row._sum?.costUsd ?? 0), 0);

  const orgCeiling = policy.dailyCeilingUsd ?? null;
  const providerCeiling = readProviderCeiling(
    policy.providerDailyCeilingsUsd,
    provider
  );

  const detail = {
    windowSpendUsd: Number(orgSpendUsd.toFixed(6)),
    estimatedCostUsd,
    orgDailyCeilingUsd: orgCeiling,
    providerDailyCeilingUsd: providerCeiling,
  };

  // A row that sets NO ceiling is not a budget, and "no budget means no
  // spending" has to mean that or it means nothing. An earlier revision
  // refused only when the ROW was missing, so an OrgBudgetPolicy with
  // dailyCeilingUsd = null and no provider ceilings authorised unbounded
  // Governor spend — the exact state this module claims to make impossible.
  // (Independent review, cursor lane, P2 on budget.ts.) The legacy path fills
  // that gap with SYNTHEX_DEFAULT_* env ceilings; the Governor deliberately
  // does not read env for policy, so it refuses instead.
  if (orgCeiling === null && providerCeiling === null) {
    return {
      allowed: false,
      verdict: 'budget_unconfigured:no_ceiling_set',
      outcome: 'refused_budget_unconfigured',
      detail,
    };
  }

  if (
    providerCeiling !== null &&
    providerSpendUsd + estimatedCostUsd > providerCeiling
  ) {
    return {
      allowed: false,
      verdict: `provider_daily_exhausted:${provider}:mode=${policy.enforcementMode}`,
      outcome: 'refused_budget_exhausted',
      detail,
    };
  }

  if (orgCeiling !== null && orgSpendUsd + estimatedCostUsd > orgCeiling) {
    return {
      allowed: false,
      verdict: `org_daily_exhausted:mode=${policy.enforcementMode}`,
      outcome: 'refused_budget_exhausted',
      detail,
    };
  }

  return {
    allowed: true,
    verdict: 'within_ceiling',
    outcome: null,
    detail,
  };
}
