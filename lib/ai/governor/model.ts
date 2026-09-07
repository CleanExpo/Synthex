/**
 * GOVERNOR — model resolution (SYN-1196).
 *
 * THE REGISTRY STAYS A FILE IN GIT. lib/ai/model-registry.ts is versioned
 * config, not a database table, because the Model Scout's deliverable is
 * "a config PR with an eval receipt" and a database row can never be a pull
 * request. The database holds only eval receipts (ModelEvalReceipt) and
 * observed provider state; the decision of which model runs stays in git,
 * reviewable and revertable.
 *
 * Consequence for every Governor-mediated call: the model is RESOLVED here,
 * from the registry, before anything else happens. There is no code path that
 * accepts a caller's model string and passes it to a provider unchecked — an
 * unregistered or deprecated id is a refusal, not a warning.
 *
 * This module deliberately depends only on the registry's EXPORTED API
 * (getLatestModel / getModel / isModelAvailable / ModelConfig). It never reads
 * the LATEST_MODELS literal or hardcodes an id, so a registry regeneration
 * (e.g. the chore/model-registry-current-gen branch) cannot break it.
 */

import {
  getLatestModel,
  getModel,
  isModelAvailable,
  type ModelConfig,
} from '@/lib/ai/model-registry';
import type { GovernorProvider, ModelSelector } from './types';

export interface ModelResolution {
  ok: boolean;
  model: ModelConfig | null;
  reason: string;
}

/**
 * Resolve the model for a governed call from the registry.
 *
 * `{ kind: 'latest' }` asks the registry for the current frontier model for
 * the provider — this is how a runner stays "always on current frontier
 * models" without naming one. `{ kind: 'registered', modelId }` pins a
 * specific model, but only if the registry still lists it and has not marked
 * it deprecated.
 */
export function resolveModel(
  provider: GovernorProvider,
  selector: ModelSelector
): ModelResolution {
  try {
    if (selector.kind === 'latest') {
      // Throws when a provider has no non-deprecated model at all.
      const model = getLatestModel(provider);
      return { ok: true, model, reason: 'registry_latest' };
    }

    const model = getModel(provider, selector.modelId);
    if (!model) {
      return {
        ok: false,
        model: null,
        reason: `model_not_in_registry:${selector.modelId}`,
      };
    }

    // isModelAvailable is the registry's own deprecation gatekeeper. Before
    // SYN-1196 it had a single caller in the whole runtime
    // (lib/ai/model-manager.ts); the Governor makes it load-bearing.
    if (!isModelAvailable(provider, selector.modelId)) {
      return {
        ok: false,
        model: null,
        reason: `model_deprecated:${selector.modelId}`,
      };
    }

    return { ok: true, model, reason: 'registry_pinned' };
  } catch (error) {
    return {
      ok: false,
      model: null,
      reason: `registry_error:${
        error instanceof Error ? error.message : 'unknown'
      }`,
    };
  }
}

/**
 * Estimated cost in USD from the REGISTRY's own per-model pricing.
 *
 * Not lib/pipelines/track-cost.ts's MODEL_RATES: that table is hardcoded,
 * Anthropic-only, and silently falls back to Sonnet pricing for anything it
 * does not know — which would make an OpenAI or Gemini budget check quietly
 * wrong. The registry carries costPer1kTokens for every model it lists, so the
 * estimate moves with the config PR that changes the model.
 */
export function estimateCostUsd(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number
): number {
  const cost =
    (inputTokens / 1000) * model.costPer1kTokens.input +
    (outputTokens / 1000) * model.costPer1kTokens.output;
  return Number(cost.toFixed(6));
}
