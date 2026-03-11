/**
 * Bayesian Optimisation Surface Adapter — Psychology Levers
 *
 * Provides BO-optimised effectiveness multipliers for each persuasion principle.
 * Applied in PsychologyAnalyzer.calculateOverallScore() to modulate each
 * principle's contribution to the overall psychology score.
 *
 * Surface: 'psychology_levers'
 * Dimensions: one multiplier per persuasion principle (8 total)
 * Range: 0.50 – 1.50 (1.0 = neutral, no change from default)
 *
 * @module lib/bayesian/surfaces/psychology-levers
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PsychologyLeverWeights {
  socialProofWeight:  number; // 0.50 – 1.50
  scarcityWeight:     number; // 0.50 – 1.50
  authorityWeight:    number; // 0.50 – 1.50
  reciprocityWeight:  number; // 0.50 – 1.50
  lossAversionWeight: number; // 0.50 – 1.50
  commitmentWeight:   number; // 0.50 – 1.50
  likingWeight:       number; // 0.50 – 1.50
  anchoringWeight:    number; // 0.50 – 1.50
}

export interface PsychologyLeverResult {
  weights: PsychologyLeverWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — derived from effectivenessScore values in
 * PSYCHOLOGY_PRINCIPLES (psychology-analyzer.ts) divided by 100.
 * No sum constraint — each is an independent effectiveness multiplier.
 */
export const PSYCHOLOGY_LEVER_DEFAULTS: PsychologyLeverWeights = {
  socialProofWeight:  0.92,
  scarcityWeight:     0.90,
  authorityWeight:    0.88,
  reciprocityWeight:  0.85,
  lossAversionWeight: 0.89,
  commitmentWeight:   0.82,
  likingWeight:       0.80,
  anchoringWeight:    0.86,
};

export const PSYCHOLOGY_LEVER_BOUNDS: Record<keyof PsychologyLeverWeights, ParameterBounds> = {
  socialProofWeight:  { min: 0.50, max: 1.50 },
  scarcityWeight:     { min: 0.50, max: 1.50 },
  authorityWeight:    { min: 0.50, max: 1.50 },
  reciprocityWeight:  { min: 0.50, max: 1.50 },
  lossAversionWeight: { min: 0.50, max: 1.50 },
  commitmentWeight:   { min: 0.50, max: 1.50 },
  likingWeight:       { min: 0.50, max: 1.50 },
  anchoringWeight:    { min: 0.50, max: 1.50 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the psychology_levers surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns PSYCHOLOGY_LEVER_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getPsychologyLeverWeights(
  orgId: string,
): Promise<PsychologyLeverResult> {
  const result = await getOptimisedWeightsOrFallback(
    'psychology_levers',
    orgId,
    () => ({ ...PSYCHOLOGY_LEVER_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: PsychologyLeverWeights = {
    socialProofWeight:  raw.socialProofWeight  ?? PSYCHOLOGY_LEVER_DEFAULTS.socialProofWeight,
    scarcityWeight:     raw.scarcityWeight     ?? PSYCHOLOGY_LEVER_DEFAULTS.scarcityWeight,
    authorityWeight:    raw.authorityWeight    ?? PSYCHOLOGY_LEVER_DEFAULTS.authorityWeight,
    reciprocityWeight:  raw.reciprocityWeight  ?? PSYCHOLOGY_LEVER_DEFAULTS.reciprocityWeight,
    lossAversionWeight: raw.lossAversionWeight ?? PSYCHOLOGY_LEVER_DEFAULTS.lossAversionWeight,
    commitmentWeight:   raw.commitmentWeight   ?? PSYCHOLOGY_LEVER_DEFAULTS.commitmentWeight,
    likingWeight:       raw.likingWeight       ?? PSYCHOLOGY_LEVER_DEFAULTS.likingWeight,
    anchoringWeight:    raw.anchoringWeight    ?? PSYCHOLOGY_LEVER_DEFAULTS.anchoringWeight,
  };

  return { weights, source: result.source };
}
