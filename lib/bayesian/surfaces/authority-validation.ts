/**
 * Bayesian Optimisation Surface Adapter — Authority Validation
 *
 * Provides BO-optimised priority weights for claim-type detection ordering.
 * Higher weight = the claim type takes precedence when multiple patterns match.
 *
 * Surface: 'authority_validation'
 * Dimensions: one priority weight per claim type (6 total)
 *
 * @module lib/bayesian/surfaces/authority-validation
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthorityValidationWeights {
  regulatoryPriority:  number; // 0.05 – 0.50
  statisticalPriority: number; // 0.05 – 0.50
  temporalPriority:    number; // 0.05 – 0.50
  causalPriority:      number; // 0.05 – 0.50
  comparativePriority: number; // 0.05 – 0.50
  factualPriority:     number; // 0.05 – 0.50
}

export interface AuthorityValidationResult {
  weights: AuthorityValidationWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — mirror the existing hardcoded priority order in
 * claim-extractor.ts: regulatory > statistical > temporal > causal > comparative > factual.
 * Each is a priority multiplier, not a probability distribution (no sumEquals constraint).
 */
export const AUTHORITY_VALIDATION_DEFAULTS: AuthorityValidationWeights = {
  regulatoryPriority:  0.30,
  statisticalPriority: 0.25,
  temporalPriority:    0.15,
  causalPriority:      0.15,
  comparativePriority: 0.10,
  factualPriority:     0.05,
};

export const AUTHORITY_VALIDATION_BOUNDS: Record<keyof AuthorityValidationWeights, ParameterBounds> = {
  regulatoryPriority:  { min: 0.05, max: 0.50 },
  statisticalPriority: { min: 0.05, max: 0.50 },
  temporalPriority:    { min: 0.05, max: 0.50 },
  causalPriority:      { min: 0.05, max: 0.50 },
  comparativePriority: { min: 0.05, max: 0.50 },
  factualPriority:     { min: 0.05, max: 0.50 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the authority_validation surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns AUTHORITY_VALIDATION_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getAuthorityValidationWeights(
  orgId: string,
): Promise<AuthorityValidationResult> {
  const result = await getOptimisedWeightsOrFallback(
    'authority_validation',
    orgId,
    () => ({ ...AUTHORITY_VALIDATION_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: AuthorityValidationWeights = {
    regulatoryPriority:  raw.regulatoryPriority  ?? AUTHORITY_VALIDATION_DEFAULTS.regulatoryPriority,
    statisticalPriority: raw.statisticalPriority ?? AUTHORITY_VALIDATION_DEFAULTS.statisticalPriority,
    temporalPriority:    raw.temporalPriority    ?? AUTHORITY_VALIDATION_DEFAULTS.temporalPriority,
    causalPriority:      raw.causalPriority      ?? AUTHORITY_VALIDATION_DEFAULTS.causalPriority,
    comparativePriority: raw.comparativePriority ?? AUTHORITY_VALIDATION_DEFAULTS.comparativePriority,
    factualPriority:     raw.factualPriority     ?? AUTHORITY_VALIDATION_DEFAULTS.factualPriority,
  };

  return { weights, source: result.source };
}
