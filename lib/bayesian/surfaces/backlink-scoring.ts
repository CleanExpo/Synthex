/**
 * Bayesian Optimisation Surface Adapter — Backlink Scoring
 *
 * Provides BO-optimised per-type multipliers for ranking backlink prospects.
 * Higher weight = higher priority for that opportunity type in the final sort.
 *
 * Surface: 'backlink_scoring'
 * Dimensions: one weight per BacklinkOpportunityType (5 total)
 *
 * @module lib/bayesian/surfaces/backlink-scoring
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BacklinkScoringWeights {
  resourcePageWeight:      number; // 0.05 – 0.50
  guestPostWeight:         number; // 0.05 – 0.50
  brokenLinkWeight:        number; // 0.05 – 0.50
  competitorLinkWeight:    number; // 0.05 – 0.50
  journalistMentionWeight: number; // 0.05 – 0.50
}

export interface BacklinkScoringResult {
  weights: BacklinkScoringWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — equal weighting per opportunity type.
 * Sum is not constrained — weights are per-type DA multipliers.
 */
export const BACKLINK_SCORING_DEFAULTS: BacklinkScoringWeights = {
  resourcePageWeight:      0.25,
  guestPostWeight:         0.25,
  brokenLinkWeight:        0.20,
  competitorLinkWeight:    0.15,
  journalistMentionWeight: 0.15,
};

export const BACKLINK_SCORING_BOUNDS: Record<keyof BacklinkScoringWeights, ParameterBounds> = {
  resourcePageWeight:      { min: 0.05, max: 0.50 },
  guestPostWeight:         { min: 0.05, max: 0.50 },
  brokenLinkWeight:        { min: 0.05, max: 0.50 },
  competitorLinkWeight:    { min: 0.05, max: 0.50 },
  journalistMentionWeight: { min: 0.05, max: 0.50 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the backlink_scoring surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns BACKLINK_SCORING_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getBacklinkScoringWeights(
  orgId: string,
): Promise<BacklinkScoringResult> {
  const result = await getOptimisedWeightsOrFallback(
    'backlink_scoring',
    orgId,
    () => ({ ...BACKLINK_SCORING_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: BacklinkScoringWeights = {
    resourcePageWeight:      raw.resourcePageWeight      ?? BACKLINK_SCORING_DEFAULTS.resourcePageWeight,
    guestPostWeight:         raw.guestPostWeight         ?? BACKLINK_SCORING_DEFAULTS.guestPostWeight,
    brokenLinkWeight:        raw.brokenLinkWeight        ?? BACKLINK_SCORING_DEFAULTS.brokenLinkWeight,
    competitorLinkWeight:    raw.competitorLinkWeight    ?? BACKLINK_SCORING_DEFAULTS.competitorLinkWeight,
    journalistMentionWeight: raw.journalistMentionWeight ?? BACKLINK_SCORING_DEFAULTS.journalistMentionWeight,
  };

  return { weights, source: result.source };
}
