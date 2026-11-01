/**
 * GOVERNOR — shared types (SYN-1196, Goal Card #5).
 *
 * The Governor is the single seam every AI action in the Synthex runtime
 * passes through. Its contract, in one sentence: no AI call happens unless a
 * per-brand flag permits it, the brand's own key pays for it, the brand's
 * budget can afford it, and a receipt records it — including when it is
 * refused.
 *
 * FAIL-CLOSED BY CONTRACT. This is the deliberate opposite of
 * lib/ai/budget-enforcer.ts, whose module header documents a fail-OPEN
 * doctrine (missing table / read error ⇒ warn and proceed) so that a
 * deploy which outruns its migration cannot break generation. The Governor
 * cannot inherit that: a control-plane read failure here means we do not know
 * whether the runner is permitted, whose key to use, or what the budget is —
 * and "we do not know" must never resolve to "go ahead". Every unknown is a
 * refusal, and every refusal is receipted.
 */

import type { ModelConfig } from '@/lib/ai/model-registry';
import type { GovernorMode } from './mode';
import type { BuildCapDetail, GovernedBuild } from './build-cap';

export type { GovernorMode } from './mode';

/**
 * Providers the Governor mediates: every provider the registry knows. Kept as
 * its own union so a provider added to the registry is not governed until it
 * is added here on purpose.
 */
export type GovernorProvider = 'anthropic' | 'openai' | 'google' | 'openrouter';

export const GOVERNOR_PROVIDERS: readonly GovernorProvider[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
] as const;

/** Brand-level kill-switch row marker — see RunnerFlag in prisma/schema.prisma. */
export const BRAND_WIDE_RUNNER = '*';

/**
 * Terminal outcome of a governed call. Written verbatim to
 * pipeline_cost_ledger.outcome, so these strings are a stored contract —
 * append, never rename.
 */
export type GovernorOutcome =
  | 'completed'
  /** No RunnerFlag row at all. Default off: absence is a refusal, not a permit. */
  | 'refused_flag_missing'
  /** Row exists, enabled = false. */
  | 'refused_flag_disabled'
  /** killSwitch = true on the runner row or the brand-wide '*' row. */
  | 'refused_kill_switch'
  /** No APICredential row for this org + provider. */
  | 'refused_byok_missing'
  /** Credential exists but revokedAt is set. */
  | 'refused_byok_revoked'
  /** Credential exists, not revoked, but isActive = false. */
  | 'refused_byok_inactive'
  /** Credential exists but could not be decrypted — treated as unusable, never bypassed. */
  | 'refused_byok_undecryptable'
  /** Estimated spend would breach the org or per-provider daily ceiling. */
  | 'refused_budget_exhausted'
  /** No OrgBudgetPolicy row for the brand. No budget means no spending. */
  | 'refused_budget_unconfigured'
  /**
   * The cost estimate was not a finite, non-negative number. A NaN or negative
   * estimate makes `spend + estimate > ceiling` false under IEEE semantics, so
   * an unguarded comparison would ALLOW spending on an already-exhausted
   * budget. Refusing on the input is the only fail-closed answer.
   */
  | 'refused_budget_invalid_estimate'
  /**
   * Some OTHER number reaching a ceiling comparison was not a finite,
   * non-negative USD amount — a corrupt policy ceiling, or a poisoned ledger
   * row. Same IEEE fail-open class as refused_budget_invalid_estimate, on a
   * different operand; the verdict string says which.
   */
  | 'refused_budget_untrusted_input'
  /** Requested model is absent from the registry or deprecated. */
  | 'refused_model_unavailable'
  /** A control-plane read (flag / credential / budget) failed. Unknown ⇒ refuse. */
  | 'refused_control_plane_error'
  /** Flags, key and budget all passed; the provider call itself threw. */
  | 'failed_provider_error'
  /**
   * The call is part of a build (GovernedCallInput.build) and the build's
   * ledger spend plus this call's estimate would exceed the per-build cap.
   */
  | 'refused_build_cap_exceeded';

/** Every outcome that is not a served call. */
export type GovernorRefusal = Exclude<GovernorOutcome, 'completed'>;

export function isRefusal(
  outcome: GovernorOutcome
): outcome is GovernorRefusal {
  return outcome !== 'completed';
}

/**
 * How the model was chosen. There is no free-string path: `modelId` is looked
 * up in the registry and refused if absent, so a caller cannot smuggle an
 * unregistered model through.
 */
export type ModelSelector =
  | { kind: 'latest' }
  | { kind: 'registered'; modelId: string };

/**
 * Written to pipeline_cost_ledger.provenance. This is the "no invisible AI"
 * half of the receipt: it records not just what was spent but why the call was
 * allowed or refused, and where the model came from.
 */
export interface GovernorProvenance {
  /** Always 'registry-file' — the registry is versioned config, never a DB row. */
  modelSource: 'registry-file';
  modelId: string;
  modelSelector: ModelSelector['kind'];
  provider: GovernorProvider;
  runner: string;
  brandSlug: string;
  organizationId: string;
  /** Flag verdict, e.g. 'enabled' | 'missing' | 'disabled' | 'kill_switch'. */
  flagVerdict: string;
  /** Key verdict, e.g. 'byok_present' | 'missing' | 'revoked'. Never the key. */
  keyVerdict: string;
  /** Budget verdict, e.g. 'within_ceiling' | 'org_daily_exhausted'. */
  budgetVerdict: string;
  /** Ceilings and observed spend in USD at decision time, when known. */
  budgetDetail?: {
    windowSpendUsd: number;
    estimatedCostUsd: number;
    orgDailyCeilingUsd: number | null;
    providerDailyCeilingUsd: number | null;
  };
  /**
   * Present only when the call carried `build`: the per-build cap decision
   * (spent so far under run_id = buildId, the estimate and the cap, in USD).
   */
  buildCap?: BuildCapDetail;
  /** Populated when the Governor refused or the provider threw. */
  errorClass?: string;
  /**
   * Set whenever the provider's token counts were unusable (NaN, negative)
   * and recorded as 0, whatever errorClass says — an 'unpriced_model' receipt
   * must not hide it.
   */
  tokenCountVerdict?: 'provider_returned_unusable_token_counts';
  /**
   * Shadow mode only: the refusal the Governor WOULD have made in enforcing
   * mode. The call ran anyway; this row is still its single receipt.
   */
  shadowRefusal?: { outcome: GovernorRefusal; reason: string };
  decidedAt: string;
}

/** What the caller's own provider call must return. */
export interface ProviderCallResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  /**
   * The model the call actually used, when the caller knows it. The receipt
   * records and prices this id; an id the registry does not list is recorded
   * at cost 0 with errorClass 'unpriced_model', never guessed.
   */
  modelId?: string;
}

/**
 * Everything the Governor resolved before handing control to the caller. The
 * apiKey here is ALWAYS the brand's own key — the Governor has no code path
 * that reads a platform key from the environment.
 */
export interface ResolvedCallContext {
  mode: GovernorMode;
  /** Null only in shadow mode, when registry resolution failed or was not reached. */
  model: ModelConfig | null;
  provider: GovernorProvider;
  /** Null only in shadow mode, when BYOK did not resolve or was not reached. */
  apiKey: string | null;
  organizationId: string;
  brandSlug: string;
  runner: string;
  runId: string;
}

export interface GovernedCallInput<T> {
  organizationId: string;
  brandSlug: string;
  /** Runner name as it appears in RunnerFlag.runner. Never '*'. */
  runner: string;
  provider: GovernorProvider;
  /** Registry selection. No literal model strings on this path. */
  model: ModelSelector;
  /** Ledger pipeline_name — the existing cost-report dimension. */
  pipelineName: string;
  /**
   * Ledger run_id for this call's receipt. With `build`, the buildId IS the
   * run_id; a runId that disagrees with it is refused.
   */
  runId?: string;
  /**
   * Opt-in per-build spending cap. The buildId becomes this call's ledger
   * run_id, and the call is refused when the build's ledger spend plus this
   * call's estimate would exceed the cap. Absent: no build cap, unchanged.
   */
  build?: GovernedBuild;
  /** Pre-spend estimate used for the budget check. */
  estimate: { inputTokens: number; outputTokens: number };
  /**
   * Absent means 'enforcing'. In 'shadow' a would-be refusal is logged and
   * receipted, and the call still runs. Routes pass GOVERNOR_MODE.
   */
  mode?: GovernorMode;
  /**
   * The actual provider call. In enforcing mode only reached once every gate
   * has passed; in shadow mode always reached.
   */
  execute: (ctx: ResolvedCallContext) => Promise<ProviderCallResult<T>>;
}

export interface GovernorReceipt {
  pipelineName: string;
  clientId: string;
  runId: string;
  model: string;
  provider: GovernorProvider;
  brandSlug: string;
  runner: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  outcome: GovernorOutcome;
  provenance: GovernorProvenance;
  /** True when the row reached pipeline_cost_ledger; false when only logged. */
  persisted: boolean;
}

export type GovernedCallResult<T> =
  | { ok: true; outcome: 'completed'; data: T; receipt: GovernorReceipt }
  | {
      ok: false;
      outcome: GovernorRefusal;
      reason: string;
      receipt: GovernorReceipt;
    };
