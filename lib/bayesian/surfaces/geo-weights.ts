/**
 * Bayesian Optimisation Surface Adapter — GEO Score Weights
 *
 * Provides BO-optimised weights for the five GEO scoring dimensions.
 * Falls back to fixed heuristic weights when the BO service is unavailable.
 *
 * Surface: 'geo_score_weights'
 * Dimensions: citability, structure, multiModal, authority, technical
 * Constraint: sumEquals 1 (enforced at BO service level)
 *
 * @module lib/bayesian/surfaces/geo-weights
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GeoScoreWeights {
  citability: number;
  structure: number;
  multiModal: number;
  authority: number;
  technical: number;
}

export interface GeoScoreWeightResult extends WeightResult {
  weights: GeoScoreWeights;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — mirror the hard-coded constants from geo-analyzer.ts.
 * Sum: 1.0
 */
export const GEO_SCORE_DEFAULTS: GeoScoreWeights = {
  citability: 0.25,
  structure:  0.20,
  multiModal: 0.15,
  authority:  0.20,
  technical:  0.20,
};

/**
 * Parameter bounds for BO.
 * Each dimension: 0.05 – 0.50.
 * The sumEquals: 1 constraint is enforced at the BO service level.
 */
export const GEO_SCORE_BOUNDS: Record<keyof GeoScoreWeights, ParameterBounds> = {
  citability: { min: 0.05, max: 0.50 },
  structure:  { min: 0.05, max: 0.50 },
  multiModal: { min: 0.05, max: 0.50 },
  authority:  { min: 0.05, max: 0.50 },
  technical:  { min: 0.05, max: 0.50 },
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the geo_score_weights surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns GEO_SCORE_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getGeoScoreWeights(orgId: string): Promise<GeoScoreWeightResult> {
  const result = await getOptimisedWeightsOrFallback(
    'geo_score_weights',
    orgId,
    () => ({ ...GEO_SCORE_DEFAULTS }),
  );

  // Cast the generic Record<string, number> to typed GeoScoreWeights
  const raw = result.weights as Record<string, number>;
  const weights: GeoScoreWeights = {
    citability: raw.citability  ?? GEO_SCORE_DEFAULTS.citability,
    structure:  raw.structure   ?? GEO_SCORE_DEFAULTS.structure,
    multiModal: raw.multiModal  ?? GEO_SCORE_DEFAULTS.multiModal,
    authority:  raw.authority   ?? GEO_SCORE_DEFAULTS.authority,
    technical:  raw.technical   ?? GEO_SCORE_DEFAULTS.technical,
  };

  return { weights, source: result.source };
}
