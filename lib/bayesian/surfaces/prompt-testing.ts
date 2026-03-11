/**
 * Bayesian Optimisation Surface Adapter — Prompt Testing
 *
 * Provides BO-optimised parameters for the AI prompt tester.
 * Controls LLM temperature, max token budget, and quality scoring bias.
 *
 * Surface: 'prompt_testing'
 * Dimensions: temperature, maxTokens (integer), positivityBias
 *
 * @module lib/bayesian/surfaces/prompt-testing
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PromptTestingParams {
  temperature:    number;  // 0.30 – 0.90
  maxTokens:      number;  // 400 – 1200 (integer; BO returns float — round before use)
  positivityBias: number;  // 0.0 – 1.0
}

export interface PromptTestingParamsResult {
  params:  PromptTestingParams;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic parameters — mirror the hardcoded constants in prompt-tester.ts.
 */
export const PROMPT_TESTING_DEFAULTS: PromptTestingParams = {
  temperature:    0.70,
  maxTokens:      800,
  positivityBias: 0.50,
};

/**
 * Parameter bounds for BO.
 * maxTokens is treated as a continuous float by BO; Math.round() is applied on retrieval.
 */
export const PROMPT_TESTING_BOUNDS: Record<keyof PromptTestingParams, ParameterBounds> = {
  temperature:    { min: 0.30, max: 0.90 },
  maxTokens:      { min: 400,  max: 1200 },
  positivityBias: { min: 0.00, max: 1.00 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised parameters for the prompt_testing surface.
 *
 * Returns optimised parameters when the BO service is available and has
 * sufficient observations, otherwise returns PROMPT_TESTING_DEFAULTS.
 *
 * Note: maxTokens is rounded to an integer because the OpenRouter API
 * requires an integer value for max_tokens.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getPromptTestingParams(
  orgId: string,
): Promise<PromptTestingParamsResult> {
  const result = await getOptimisedWeightsOrFallback(
    'prompt_testing',
    orgId,
    () => ({
      temperature:    PROMPT_TESTING_DEFAULTS.temperature,
      maxTokens:      PROMPT_TESTING_DEFAULTS.maxTokens,
      positivityBias: PROMPT_TESTING_DEFAULTS.positivityBias,
    }),
  );

  // Cast the generic Record<string, number> to typed PromptTestingParams
  const raw = result.weights as Record<string, number>;
  const params: PromptTestingParams = {
    temperature:    raw.temperature    ?? PROMPT_TESTING_DEFAULTS.temperature,
    maxTokens:      Math.round(raw.maxTokens ?? PROMPT_TESTING_DEFAULTS.maxTokens),
    positivityBias: raw.positivityBias ?? PROMPT_TESTING_DEFAULTS.positivityBias,
  };

  return { params, source: result.source };
}
