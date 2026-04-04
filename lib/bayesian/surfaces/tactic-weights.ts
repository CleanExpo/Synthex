/**
 * Bayesian Optimisation Surface Adapter — Tactic Weights
 *
 * Provides BO-optimised weights for the nine Princeton GEO tactics.
 * Falls back to fixed heuristic weights when the BO service is unavailable.
 *
 * Surface: 'tactic_weights'
 * Dimensions: 9 GEOTactic values
 * Constraint: sumEquals 1 (enforced at BO service level)
 *
 * @module lib/bayesian/surfaces/tactic-weights
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';
import type { GEOTactic } from '@/lib/geo/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TacticWeights = Record<GEOTactic, number>;

export interface TacticWeightResult {
  weights: TacticWeights;
  source: WeightResult['source'];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — mirror the hard-coded COMPOSITE_WEIGHTS from tactic-scorer.ts.
 * Based on Princeton KDD 2024 paper effectiveness ratings.
 * Sum: 1.0
 */
export const TACTIC_DEFAULTS: TacticWeights = {
  'authoritative-citations': 0.20,
  'statistics':              0.18,
  'quotations':              0.15,
  'fluency':                 0.12,
  'readability':             0.10,
  'technical-vocabulary':    0.09,
  'uniqueness':              0.08,
  'information-flow':        0.05,
  'persuasion':              0.03,
};

/**
 * Parameter bounds for BO.
 * Each dimension: 0.01 – 0.40.
 * The sumEquals: 1 constraint is enforced at the BO service level.
 */
export const TACTIC_BOUNDS: Record<GEOTactic, ParameterBounds> = {
  'authoritative-citations': { min: 0.01, max: 0.40 },
  'statistics':              { min: 0.01, max: 0.40 },
  'quotations':              { min: 0.01, max: 0.40 },
  'fluency':                 { min: 0.01, max: 0.40 },
  'readability':             { min: 0.01, max: 0.40 },
  'technical-vocabulary':    { min: 0.01, max: 0.40 },
  'uniqueness':              { min: 0.01, max: 0.40 },
  'information-flow':        { min: 0.01, max: 0.40 },
  'persuasion':              { min: 0.01, max: 0.40 },
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the tactic_weights surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns TACTIC_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getTacticWeights(orgId: string): Promise<TacticWeightResult> {
  const result = await getOptimisedWeightsOrFallback(
    'tactic_weights',
    orgId,
    () => ({ ...TACTIC_DEFAULTS }),
  );

  // Cast the generic Record<string, number> to typed TacticWeights
  const raw = result.weights as Record<string, number>;
  const weights: TacticWeights = {
    'authoritative-citations': raw['authoritative-citations'] ?? TACTIC_DEFAULTS['authoritative-citations'],
    'statistics':              raw['statistics']              ?? TACTIC_DEFAULTS['statistics'],
    'quotations':              raw['quotations']              ?? TACTIC_DEFAULTS['quotations'],
    'fluency':                 raw['fluency']                 ?? TACTIC_DEFAULTS['fluency'],
    'readability':             raw['readability']             ?? TACTIC_DEFAULTS['readability'],
    'technical-vocabulary':    raw['technical-vocabulary']    ?? TACTIC_DEFAULTS['technical-vocabulary'],
    'uniqueness':              raw['uniqueness']              ?? TACTIC_DEFAULTS['uniqueness'],
    'information-flow':        raw['information-flow']        ?? TACTIC_DEFAULTS['information-flow'],
    'persuasion':              raw['persuasion']              ?? TACTIC_DEFAULTS['persuasion'],
  };

  return { weights, source: result.source };
}
