/**
 * Bayesian Optimisation Surface Adapter — Experiment Sampling
 *
 * Provides BO-optimised sampling weights for the experiment type priority
 * order in the A/B experiment designer.
 *
 * Surface: 'experiment_sampling'
 * Dimensions: 6 experiment type weights (no sum constraint)
 *
 * @module lib/bayesian/surfaces/experiment-sampling
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExperimentSamplingWeights {
  titleTag:         number;
  metaDescription:  number;
  h1:               number;
  schema:           number;
  contentStructure: number;
  internalLinks:    number;
}

export interface ExperimentSamplingResult {
  weights: ExperimentSamplingWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — reflect the current rule-based priority order.
 * Higher values = higher suggestion priority within the same priority tier.
 */
export const EXPERIMENT_SAMPLING_DEFAULTS: ExperimentSamplingWeights = {
  titleTag:         0.20,
  metaDescription:  0.20,
  h1:               0.20,
  schema:           0.15,
  contentStructure: 0.15,
  internalLinks:    0.10,
};

/**
 * Parameter bounds for BO. No sumEquals constraint — weights are used as
 * relative priority scores within each priority tier, not a distribution.
 */
export const EXPERIMENT_SAMPLING_BOUNDS: Record<keyof ExperimentSamplingWeights, ParameterBounds> = {
  titleTag:         { min: 0.05, max: 0.40 },
  metaDescription:  { min: 0.05, max: 0.40 },
  h1:               { min: 0.05, max: 0.40 },
  schema:           { min: 0.05, max: 0.40 },
  contentStructure: { min: 0.05, max: 0.40 },
  internalLinks:    { min: 0.05, max: 0.40 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised sampling weights for the experiment_sampling surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns EXPERIMENT_SAMPLING_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getExperimentSamplingWeights(
  orgId: string,
): Promise<ExperimentSamplingResult> {
  const result = await getOptimisedWeightsOrFallback(
    'experiment_sampling',
    orgId,
    () => ({ ...EXPERIMENT_SAMPLING_DEFAULTS }),
  );

  // Cast the generic Record<string, number> to typed ExperimentSamplingWeights
  const raw = result.weights as Record<string, number>;
  const weights: ExperimentSamplingWeights = {
    titleTag:         raw.titleTag         ?? EXPERIMENT_SAMPLING_DEFAULTS.titleTag,
    metaDescription:  raw.metaDescription  ?? EXPERIMENT_SAMPLING_DEFAULTS.metaDescription,
    h1:               raw.h1               ?? EXPERIMENT_SAMPLING_DEFAULTS.h1,
    schema:           raw.schema           ?? EXPERIMENT_SAMPLING_DEFAULTS.schema,
    contentStructure: raw.contentStructure ?? EXPERIMENT_SAMPLING_DEFAULTS.contentStructure,
    internalLinks:    raw.internalLinks    ?? EXPERIMENT_SAMPLING_DEFAULTS.internalLinks,
  };

  return { weights, source: result.source };
}
