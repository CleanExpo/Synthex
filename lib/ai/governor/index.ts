/**
 * GOVERNOR — the seam every AI action passes through (SYN-1196, Goal Card #5).
 *
 * One exported function, `governedCall`, and one promise:
 *
 *     No AI call happens unless a per-brand flag permits it, the brand's own
 *     key pays for it, the brand's budget can afford it, and a receipt records
 *     it — including when it is refused.
 *
 * ORDER MATTERS, and it is not arbitrary:
 *
 *   1. MODEL — resolved from the registry file first, because
 *      pipeline_cost_ledger.model is NOT NULL. If resolution came later, a
 *      refusal row would have no model to write and the receipt could not be
 *      created at all. Resolving first means every outcome, including every
 *      refusal, has a complete receipt.
 *   2. FLAG — cheapest control-plane read, and the one an operator reaches for
 *      in an emergency. A killed runner must not cause a credential decrypt.
 *   3. BYOK — the brand's own key, or a refusal. Never a platform key.
 *   4. BUDGET — priced from the registry's own per-model rates.
 *   5. CALL — the caller's provider call, reached only if 1-4 all passed.
 *   6. RECEIPT — written on every path, with the ACTUAL token counts when the
 *      call ran and zeros when it did not.
 *
 * The Governor takes `organizationId` directly rather than a userId: its
 * callers are runners and crons, which have no session. A user-facing entry
 * point resolves the org first via getEffectiveOrganizationId(userId) from
 * lib/multi-business/business-scope.ts — see governedCallForUser below. (Note
 * for anyone following CLAUDE.md: that function lives in lib/multi-business/,
 * not lib/auth/, despite the auth docs pointing at lib/auth/.)
 *
 * NO HARDCODED MODEL STRINGS. Nothing on this path names a model. The registry
 * is the only source, and scripts/audit-governor-model-strings.mjs fails CI if
 * that stops being true.
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { resolveRunnerFlag } from './flags';
import { resolveBrandApiKey } from './byok';
import { checkBudget } from './budget';
import { estimateCostUsd, resolveModel } from './model';
import { writeReceipt } from './receipts';
import {
  BRAND_WIDE_RUNNER,
  type GovernedCallInput,
  type GovernedCallResult,
  type GovernorOutcome,
  type GovernorProvenance,
  type GovernorRefusal,
} from './types';

export * from './types';
export { resolveRunnerFlag } from './flags';
export { resolveBrandApiKey } from './byok';
export { checkBudget, readProviderCeiling, startOfUtcDay } from './budget';
export { estimateCostUsd, resolveModel } from './model';
export { writeReceipt } from './receipts';

/**
 * Model id recorded on a receipt when resolution itself failed. Not a model
 * string — a sentinel, because the ledger column is NOT NULL and a refusal
 * still deserves a row.
 */
const UNRESOLVED_MODEL = 'unresolved';

/**
 * A token count is usable only if it is a finite, non-negative number.
 *
 * This exists because `spend + estimate > ceiling` is FALSE for NaN and for a
 * large negative estimate, so an unguarded comparison fails OPEN on exactly the
 * inputs an attacker or a buggy runner would supply.
 */
function isUsableTokenCount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export async function governedCall<T>(
  input: GovernedCallInput<T>
): Promise<GovernedCallResult<T>> {
  const {
    organizationId,
    brandSlug,
    runner,
    provider,
    pipelineName,
    estimate,
  } = input;
  const runId = input.runId ?? randomUUID();
  const decidedAt = new Date().toISOString();

  const baseProvenance = {
    modelSource: 'registry-file' as const,
    modelSelector: input.model.kind,
    provider,
    runner,
    brandSlug,
    organizationId,
    decidedAt,
  };

  /** Write the receipt, then return the refusal it describes. */
  const refuse = async (
    outcome: GovernorRefusal,
    reason: string,
    provenance: GovernorProvenance,
    modelId: string
  ): Promise<GovernedCallResult<T>> => {
    const receipt = await writeReceipt({
      pipelineName,
      clientId: organizationId,
      runId,
      model: modelId,
      provider,
      brandSlug,
      runner,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      outcome,
      provenance,
    });
    logger.warn('Governor refused an AI call', {
      organizationId,
      brandSlug,
      runner,
      provider,
      outcome,
      reason,
      runId,
    });
    return { ok: false, outcome, reason, receipt };
  };

  // A runner may never impersonate the brand-wide kill-switch row.
  if (runner === BRAND_WIDE_RUNNER) {
    return refuse(
      'refused_flag_missing',
      `'${BRAND_WIDE_RUNNER}' is the brand kill-switch row, not a runner`,
      {
        ...baseProvenance,
        modelId: UNRESOLVED_MODEL,
        flagVerdict: 'reserved_runner_name',
        keyVerdict: 'not_reached',
        budgetVerdict: 'not_reached',
        errorClass: 'reserved_runner_name',
      },
      UNRESOLVED_MODEL
    );
  }

  // --- 1. Model, from the registry file -----------------------------------
  const resolution = resolveModel(provider, input.model);
  if (!resolution.ok || !resolution.model) {
    return refuse(
      'refused_model_unavailable',
      resolution.reason,
      {
        ...baseProvenance,
        modelId: UNRESOLVED_MODEL,
        flagVerdict: 'not_reached',
        keyVerdict: 'not_reached',
        budgetVerdict: 'not_reached',
        errorClass: resolution.reason,
      },
      UNRESOLVED_MODEL
    );
  }
  const model = resolution.model;

  // --- 2. Per-brand runner flag + kill-switch ------------------------------
  const flag = await resolveRunnerFlag(organizationId, brandSlug, runner);
  if (!flag.allowed) {
    return refuse(
      (flag.outcome ?? 'refused_flag_missing') as GovernorRefusal,
      flag.verdict,
      {
        ...baseProvenance,
        modelId: model.id,
        flagVerdict: flag.verdict,
        keyVerdict: 'not_reached',
        budgetVerdict: 'not_reached',
        errorClass: flag.verdict,
      },
      model.id
    );
  }

  // --- 3. BYOK, fail-closed ------------------------------------------------
  const key = await resolveBrandApiKey(organizationId, provider);
  if (!key.ok) {
    return refuse(
      key.outcome as GovernorRefusal,
      key.verdict,
      {
        ...baseProvenance,
        modelId: model.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: 'not_reached',
        errorClass: key.verdict,
      },
      model.id
    );
  }

  // --- 4. Budget, priced from the registry ---------------------------------
  // Token counts arrive from the caller, so they are untrusted input. NaN or a
  // negative count would produce a NaN/negative cost, and every ceiling test is
  // `spend + estimate > ceiling` — false under IEEE semantics for both, which
  // would ALLOW spending on an exhausted budget. checkBudget guards this too;
  // guarding here as well keeps the refusal specific to the caller's input
  // rather than surfacing as a generic budget verdict.
  if (
    !isUsableTokenCount(estimate.inputTokens) ||
    !isUsableTokenCount(estimate.outputTokens)
  ) {
    return refuse(
      'refused_budget_invalid_estimate',
      `non-finite or negative token estimate: in=${String(
        estimate.inputTokens
      )} out=${String(estimate.outputTokens)}`,
      {
        ...baseProvenance,
        modelId: model.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: 'budget_invalid_estimate',
        errorClass: 'budget_invalid_estimate',
      },
      model.id
    );
  }

  const estimatedCostUsd = estimateCostUsd(
    model,
    estimate.inputTokens,
    estimate.outputTokens
  );
  const budget = await checkBudget(organizationId, provider, estimatedCostUsd);
  if (!budget.allowed) {
    return refuse(
      (budget.outcome ?? 'refused_budget_exhausted') as GovernorRefusal,
      budget.verdict,
      {
        ...baseProvenance,
        modelId: model.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: budget.verdict,
        budgetDetail: budget.detail,
        errorClass: budget.verdict,
      },
      model.id
    );
  }

  // --- 5. The provider call ------------------------------------------------
  const provenance: GovernorProvenance = {
    ...baseProvenance,
    modelId: model.id,
    flagVerdict: flag.verdict,
    keyVerdict: key.verdict,
    budgetVerdict: budget.verdict,
    budgetDetail: budget.detail,
  };

  let result;
  try {
    result = await input.execute({
      model,
      provider,
      apiKey: key.apiKey,
      organizationId,
      brandSlug,
      runner,
      runId,
    });
  } catch (error) {
    const errorClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    return refuse(
      'failed_provider_error',
      error instanceof Error ? error.message : 'Unknown provider error',
      { ...provenance, errorClass },
      model.id
    );
  }

  // --- 6. Receipt, with the ACTUAL token counts ----------------------------
  // The counts come back from the provider call, so they are untrusted too. A
  // NaN here would write a NaN cost into the ledger, which then poisons every
  // budget SUM that reads it — a receipt that corrupts the ledger is worse than
  // one that is merely imprecise. Fall back to 0 and say so in provenance
  // rather than storing a number nobody can add up.
  const inputTokens = isUsableTokenCount(result.inputTokens)
    ? result.inputTokens
    : 0;
  const outputTokens = isUsableTokenCount(result.outputTokens)
    ? result.outputTokens
    : 0;
  const tokensWereUsable =
    inputTokens === result.inputTokens && outputTokens === result.outputTokens;

  const outcome: GovernorOutcome = 'completed';
  const receipt = await writeReceipt({
    pipelineName,
    clientId: organizationId,
    runId,
    model: model.id,
    provider,
    brandSlug,
    runner,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
    outcome,
    provenance: tokensWereUsable
      ? provenance
      : {
          ...provenance,
          errorClass: 'provider_returned_unusable_token_counts',
        },
  });

  return { ok: true, outcome, data: result.data, receipt };
}

/**
 * User-facing entry point. Resolves the caller's effective organisation first
 * — never trusting a client-supplied org id — then defers entirely to
 * governedCall. A user with no resolvable org is refused before any AI work.
 */
export async function governedCallForUser<T>(
  userId: string,
  input: Omit<GovernedCallInput<T>, 'organizationId'>
): Promise<GovernedCallResult<T> | { ok: false; outcome: 'no_organisation' }> {
  const { getEffectiveOrganizationId } =
    await import('@/lib/multi-business/business-scope');
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    logger.warn('Governor refused — no effective organisation for user', {
      userId,
    });
    return { ok: false, outcome: 'no_organisation' };
  }
  return governedCall({ ...input, organizationId });
}
