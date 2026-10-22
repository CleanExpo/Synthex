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
 *   0. BUILD ID — only when the call carries `build`: an unusable buildId is
 *      refused before anything else, so it can never become a receipt run_id.
 *   1. MODEL — resolved from the registry file first, because
 *      pipeline_cost_ledger.model is NOT NULL. If resolution came later, a
 *      refusal row would have no model to write and the receipt could not be
 *      created at all. Resolving first means every outcome, including every
 *      refusal, has a complete receipt.
 *   2. FLAG — cheapest control-plane read, and the one an operator reaches for
 *      in an emergency. A killed runner must not cause a credential decrypt.
 *   3. BYOK — the brand's own key, or a refusal. Never a platform key.
 *   4. BUDGET — priced from the registry's own per-model rates.
 *      4b. BUILD CAP — only when the call carries `build`: the build's
 *      ledger spend (run_id = buildId) plus the estimate must fit its cap.
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
 * SHADOW MODE (P5). With `mode: 'shadow'` every gate above is evaluated in the
 * same order; the first one that WOULD refuse is logged ('would refuse') and
 * recorded on the provenance as `shadowRefusal`, and the call then runs
 * anyway with whatever the Governor had resolved so far (model and key may be
 * null; the caller keeps its own). Still exactly one receipt per call. Absent
 * `mode` means 'enforcing', whose behaviour is unchanged.
 *
 * NO HARDCODED MODEL STRINGS. Nothing on this path names a model. The registry
 * is the only source, and scripts/audit-governor-model-strings.mjs fails CI if
 * that stops being true.
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { getModel, type ModelConfig } from '@/lib/ai/model-registry';
import { resolveRunnerFlag } from './flags';
import { resolveBrandApiKey } from './byok';
import { checkBudget } from './budget';
import { checkBuildCap, isUsableBuildId } from './build-cap';
import { estimateCostUsd, resolveModel } from './model';
import { writeReceipt } from './receipts';
import { GOVERNOR_MODE } from './mode';
import {
  BRAND_WIDE_RUNNER,
  type GovernedCallInput,
  type GovernedCallResult,
  type GovernorOutcome,
  type GovernorProvenance,
  type GovernorRefusal,
  type ProviderCallResult,
} from './types';

export * from './types';
export { resolveRunnerFlag } from './flags';
export { resolveBrandApiKey } from './byok';
export { checkBudget, readProviderCeiling, startOfUtcDay } from './budget';
export {
  checkBuildCap,
  getBuildSpend,
  resolveBuildCapUsd,
  BuildSpendUnreadableError,
  DEFAULT_BUILD_CAP_USD,
  type GovernedBuild,
  type BuildCapDecision,
  type BuildCapDetail,
  type BuildSpend,
} from './build-cap';
export { estimateCostUsd, resolveModel } from './model';
export { writeReceipt } from './receipts';
export { GOVERNOR_MODE } from './mode';

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
  const mode = input.mode ?? 'enforcing';
  // A build's buildId IS the ledger run_id of every call in it, so the build's
  // spend is one SUM over run_id (see build-cap.ts). An unusable buildId is
  // never used as a run_id — it would pool every such receipt under one blank
  // key. Gate 0 below refuses it (enforcing) or records it (shadow).
  const buildIdInvalid =
    input.build !== undefined && !isUsableBuildId(input.build?.buildId);
  const runId =
    input.build && !buildIdInvalid
      ? input.build.buildId
      : (input.runId ?? randomUUID());
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

  // What the gates have resolved so far; handed to execute in shadow mode.
  let model: ModelConfig | null = null;
  let apiKey: string | null = null;

  /**
   * A gate would refuse. Enforcing: refuse. Shadow: log it, record it on the
   * provenance, and run the call anyway — still one receipt.
   */
  const deny = async (
    outcome: GovernorRefusal,
    reason: string,
    provenance: GovernorProvenance
  ): Promise<GovernedCallResult<T>> => {
    if (mode !== 'shadow') {
      return refuse(outcome, reason, provenance, model?.id ?? UNRESOLVED_MODEL);
    }
    logger.warn('Governor would refuse an AI call (shadow mode, not blocked)', {
      organizationId,
      brandSlug,
      runner,
      provider,
      outcome,
      reason,
      runId,
    });
    const { errorClass: _refusalClass, ...rest } = provenance;
    return run({ ...rest, shadowRefusal: { outcome, reason } });
  };

  // --- 5 + 6. The provider call and its receipt ----------------------------
  const run = async (
    provenance: GovernorProvenance
  ): Promise<GovernedCallResult<T>> => {
    let result: ProviderCallResult<T>;
    try {
      result = await input.execute({
        mode,
        model,
        provider,
        apiKey,
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
        model?.id ?? UNRESOLVED_MODEL
      );
    }

    // The counts come back from the provider call, so they are untrusted too.
    // A NaN here would write a NaN cost into the ledger, which then poisons
    // every budget SUM that reads it — a receipt that corrupts the ledger is
    // worse than one that is merely imprecise. Fall back to 0 and say so in
    // provenance rather than storing a number nobody can add up.
    const inputTokens = isUsableTokenCount(result.inputTokens)
      ? result.inputTokens
      : 0;
    const outputTokens = isUsableTokenCount(result.outputTokens)
      ? result.outputTokens
      : 0;
    const tokensWereUsable =
      inputTokens === result.inputTokens &&
      outputTokens === result.outputTokens;

    // Record and price the model that actually ran. An id the registry does
    // not list is recorded at cost 0 as 'unpriced_model', never guessed.
    const usedModelId = result.modelId ?? model?.id ?? UNRESOLVED_MODEL;
    const priced =
      result.modelId === undefined ? model : getModel(provider, result.modelId);
    const errorClass = !priced
      ? 'unpriced_model'
      : tokensWereUsable
        ? undefined
        : 'provider_returned_unusable_token_counts';
    // Recorded on its own, so an unpriced model cannot hide the sanitised
    // counts behind its errorClass.
    const tokenVerdict = tokensWereUsable
      ? {}
      : {
          tokenCountVerdict: 'provider_returned_unusable_token_counts' as const,
        };

    const outcome: GovernorOutcome = 'completed';
    const receipt = await writeReceipt({
      pipelineName,
      clientId: organizationId,
      runId,
      model: usedModelId,
      provider,
      brandSlug,
      runner,
      inputTokens,
      outputTokens,
      costUsd: priced ? estimateCostUsd(priced, inputTokens, outputTokens) : 0,
      outcome,
      provenance: errorClass
        ? { ...provenance, modelId: usedModelId, errorClass, ...tokenVerdict }
        : { ...provenance, modelId: usedModelId, ...tokenVerdict },
    });

    return { ok: true, outcome, data: result.data, receipt };
  };

  // --- 0. A capped build needs a usable buildId (opt-in via input.build) ---
  // Checked before every other gate so no receipt in the call can carry it.
  if (buildIdInvalid) {
    return deny(
      'refused_budget_untrusted_input',
      'budget_untrusted_input:build_id_invalid',
      {
        ...baseProvenance,
        modelId: UNRESOLVED_MODEL,
        flagVerdict: 'not_reached',
        keyVerdict: 'not_reached',
        budgetVerdict: 'budget_untrusted_input:build_id_invalid',
        errorClass: 'build_id_invalid',
      }
    );
  }

  // A runner may never impersonate the brand-wide kill-switch row.
  if (runner === BRAND_WIDE_RUNNER) {
    return deny(
      'refused_flag_missing',
      `'${BRAND_WIDE_RUNNER}' is the brand kill-switch row, not a runner`,
      {
        ...baseProvenance,
        modelId: UNRESOLVED_MODEL,
        flagVerdict: 'reserved_runner_name',
        keyVerdict: 'not_reached',
        budgetVerdict: 'not_reached',
        errorClass: 'reserved_runner_name',
      }
    );
  }

  // --- 1. Model, from the registry file -----------------------------------
  const resolution = resolveModel(provider, input.model);
  if (!resolution.ok || !resolution.model) {
    return deny('refused_model_unavailable', resolution.reason, {
      ...baseProvenance,
      modelId: UNRESOLVED_MODEL,
      flagVerdict: 'not_reached',
      keyVerdict: 'not_reached',
      budgetVerdict: 'not_reached',
      errorClass: resolution.reason,
    });
  }
  const resolved = resolution.model;
  model = resolved;

  // --- 2. Per-brand runner flag + kill-switch ------------------------------
  const flag = await resolveRunnerFlag(organizationId, brandSlug, runner);
  if (!flag.allowed) {
    return deny(
      (flag.outcome ?? 'refused_flag_missing') as GovernorRefusal,
      flag.verdict,
      {
        ...baseProvenance,
        modelId: resolved.id,
        flagVerdict: flag.verdict,
        keyVerdict: 'not_reached',
        budgetVerdict: 'not_reached',
        errorClass: flag.verdict,
      }
    );
  }

  // --- 3. BYOK, fail-closed ------------------------------------------------
  const key = await resolveBrandApiKey(organizationId, provider);
  if (!key.ok) {
    return deny(key.outcome as GovernorRefusal, key.verdict, {
      ...baseProvenance,
      modelId: resolved.id,
      flagVerdict: flag.verdict,
      keyVerdict: key.verdict,
      budgetVerdict: 'not_reached',
      errorClass: key.verdict,
    });
  }
  apiKey = key.apiKey;

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
    return deny(
      'refused_budget_invalid_estimate',
      `non-finite or negative token estimate: in=${String(
        estimate.inputTokens
      )} out=${String(estimate.outputTokens)}`,
      {
        ...baseProvenance,
        modelId: resolved.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: 'budget_invalid_estimate',
        errorClass: 'budget_invalid_estimate',
      }
    );
  }

  const estimatedCostUsd = estimateCostUsd(
    resolved,
    estimate.inputTokens,
    estimate.outputTokens
  );
  const budget = await checkBudget(organizationId, provider, estimatedCostUsd);
  if (!budget.allowed) {
    return deny(
      (budget.outcome ?? 'refused_budget_exhausted') as GovernorRefusal,
      budget.verdict,
      {
        ...baseProvenance,
        modelId: resolved.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: budget.verdict,
        budgetDetail: budget.detail,
        errorClass: budget.verdict,
      }
    );
  }

  // --- 4b. Per-build spending cap (opt-in via input.build) ----------------
  // Reached only when the brand's own budget already allows the call; the
  // build cap is an extra ceiling, never a substitute for the brand budget.
  const build = input.build;
  if (build && input.runId !== undefined && input.runId !== build.buildId) {
    // Two ledger keys for one call would put its spend outside the build's
    // SUM. Refuse rather than guess which one the caller meant.
    return deny(
      'refused_budget_untrusted_input',
      'budget_untrusted_input:build_run_id_mismatch',
      {
        ...baseProvenance,
        modelId: resolved.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: 'budget_untrusted_input:build_run_id_mismatch',
        budgetDetail: budget.detail,
        errorClass: 'build_run_id_mismatch',
      }
    );
  }
  const buildCap = build ? await checkBuildCap(build, estimatedCostUsd) : null;
  if (buildCap && !buildCap.allowed) {
    return deny(
      (buildCap.outcome ?? 'refused_build_cap_exceeded') as GovernorRefusal,
      buildCap.verdict,
      {
        ...baseProvenance,
        modelId: resolved.id,
        flagVerdict: flag.verdict,
        keyVerdict: key.verdict,
        budgetVerdict: buildCap.verdict,
        budgetDetail: budget.detail,
        buildCap: buildCap.detail,
        errorClass: buildCap.verdict,
      }
    );
  }

  // --- 5. The provider call, then 6. its receipt -------------------------
  return run({
    ...baseProvenance,
    modelId: resolved.id,
    flagVerdict: flag.verdict,
    keyVerdict: key.verdict,
    budgetVerdict: budget.verdict,
    budgetDetail: budget.detail,
    ...(buildCap ? { buildCap: buildCap.detail } : {}),
  });
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

/** Thrown by governedRouteCall when an enforcing Governor refuses the call. */
export class GovernorRefusedError extends Error {
  constructor(
    readonly outcome: GovernorRefusal,
    readonly reason: string
  ) {
    super(`Governor refused: ${outcome} (${reason})`);
    this.name = 'GovernorRefusedError';
  }
}

/**
 * For route callers: run the route's existing provider call as `execute`, in
 * GOVERNOR_MODE, and get its data back. A provider error is rethrown as the
 * route's own error so existing error handling is unchanged; an enforcing
 * refusal throws GovernorRefusedError.
 */
export async function governedRouteCall<T>(
  input: Omit<GovernedCallInput<T>, 'mode'>
): Promise<T> {
  let providerError: { error: unknown } | null = null;
  const result = await governedCall({
    ...input,
    mode: GOVERNOR_MODE,
    execute: async ctx => {
      try {
        return await input.execute(ctx);
      } catch (error) {
        providerError = { error };
        throw error;
      }
    },
  });
  if (result.ok) return result.data;
  if (providerError) throw (providerError as { error: unknown }).error;
  throw new GovernorRefusedError(result.outcome, result.reason);
}
