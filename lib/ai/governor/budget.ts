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
 * THE ONE GATE. Every number that reaches a ceiling comparison passes through
 * here, and a value that fails is a REFUSAL, never a skipped check.
 *
 * This exists because the same defect was found three times on three different
 * operands. Each ceiling test has the form `spend + estimate > ceiling`, and
 * under IEEE semantics that predicate is FALSE whenever any operand is NaN, and
 * false for a sufficiently negative estimate — so an unguarded comparison
 * returns "within ceiling" on an exhausted budget. Round 3 of independent
 * review found it on the ESTIMATE; round 4 found it again on the org CEILING
 * (NaN ?? null is NaN, and NaN === null is false, so the no-ceiling refusal was
 * skipped too) and a THIRD time on the summed ledger SPEND.
 *
 * Guarding operands one at a time is how a defect class stays open while each
 * instance looks fixed. So the rule is now structural: nothing is compared
 * until it has passed asUsableUsd, and every caller below routes through it.
 */
function asUsableUsd(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/**
 * A ceiling is one of three things, and conflating the last two is exactly the
 * round-4 bug: "not configured" must skip the test, but "configured and
 * unusable" must refuse. Returning null for both made a corrupt ceiling look
 * like an absent one.
 */
type CeilingRead =
  | { kind: 'absent' }
  | { kind: 'unusable' }
  | { kind: 'set'; value: number };

function classifyCeiling(raw: unknown): CeilingRead {
  if (raw === null || raw === undefined) return { kind: 'absent' };
  const usable = asUsableUsd(raw);
  return usable === null
    ? { kind: 'unusable' }
    : { kind: 'set', value: usable };
}

/** The raw, unvalidated per-provider entry — classified by the caller. */
function rawProviderCeiling(raw: unknown, provider: GovernorProvider): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return (raw as Record<string, unknown>)[provider];
}

/**
 * Read a per-provider ceiling out of OrgBudgetPolicy.providerDailyCeilingsUsd.
 * Kept for callers that only want "the usable ceiling or nothing"; checkBudget
 * itself uses classifyCeiling so it can tell absent from corrupt.
 */
export function readProviderCeiling(
  raw: unknown,
  provider: GovernorProvider
): number | null {
  const read = classifyCeiling(rawProviderCeiling(raw, provider));
  return read.kind === 'set' ? read.value : null;
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

  const untrusted = (verdict: string): BudgetDecision => ({
    allowed: false,
    verdict: `budget_untrusted_input:${verdict}`,
    outcome: 'refused_budget_untrusted_input',
    detail: { ...EMPTY_DETAIL, estimatedCostUsd },
  });

  const rows = Array.isArray(spendRows) ? spendRows : [];

  // EVERY ledger value passes the gate before it is summed. A poisoned
  // cost_usd (NaN, -Infinity) would otherwise make `spend + estimate > ceiling`
  // false and authorise unbounded spend. Refusing is the only fail-closed
  // answer: we cannot know what has actually been spent.
  for (const row of rows) {
    if (asUsableUsd(row._sum?.costUsd ?? 0) === null) {
      logger.error('Governor ledger row is not a usable amount — refusing', {
        organizationId,
        provider,
        rowProvider: row.provider,
      });
      return untrusted('ledger_value_unusable');
    }
  }

  // Pre-SYN-1196 rows carry provider = null; they belong in the org total.
  const orgSpendUsd = rows.reduce(
    (total, row) => total + (row._sum?.costUsd ?? 0),
    0
  );
  const providerSpendUsd = rows
    .filter(row => row.provider === provider)
    .reduce((total, row) => total + (row._sum?.costUsd ?? 0), 0);

  // The TOTALS pass the gate too — summing many finite values can still
  // overflow to Infinity, and an Infinite spend would compare false as well.
  if (
    asUsableUsd(orgSpendUsd) === null ||
    asUsableUsd(providerSpendUsd) === null
  ) {
    return untrusted('spend_total_unusable');
  }

  // Absent means "no ceiling configured" and skips the test. UNUSABLE means the
  // policy row is corrupt, and must refuse — treating it as absent is precisely
  // how a NaN ceiling authorised unlimited spend.
  const orgRead = classifyCeiling(policy.dailyCeilingUsd);
  if (orgRead.kind === 'unusable') {
    logger.error('Governor org ceiling is not a usable amount — refusing', {
      organizationId,
      provider,
    });
    return untrusted('org_ceiling_unusable');
  }

  const providerRead = classifyCeiling(
    rawProviderCeiling(policy.providerDailyCeilingsUsd, provider)
  );
  if (providerRead.kind === 'unusable') {
    logger.error(
      'Governor provider ceiling is not a usable amount — refusing',
      {
        organizationId,
        provider,
      }
    );
    return untrusted('provider_ceiling_unusable');
  }

  const orgCeiling = orgRead.kind === 'set' ? orgRead.value : null;
  const providerCeiling =
    providerRead.kind === 'set' ? providerRead.value : null;

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
