/**
 * Bayesian Optimisation Surface Adapter — Content Scheduling
 *
 * Provides BO-optimised blend weights for the ML posting-time predictor.
 * Controls the ratio of historical vs. industry data and contextual multipliers.
 *
 * Surface: 'content_scheduling'
 * Dimensions: historicalWeight, industryWeight, recencyBonus, peakHourMultiplier, weekendDiscount
 *
 * @module lib/bayesian/surfaces/content-scheduling
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ContentSchedulingWeights {
  historicalWeight:   number; // 0.10 – 0.90
  industryWeight:     number; // 0.10 – 0.90
  recencyBonus:       number; // 0.00 – 0.30
  peakHourMultiplier: number; // 1.00 – 1.50
  weekendDiscount:    number; // 0.60 – 1.00
}

export interface ContentSchedulingResult {
  weights: ContentSchedulingWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — mirror the hardcoded blend ratios in
 * PostingTimePredictor.blendSlots().
 */
export const CONTENT_SCHEDULING_DEFAULTS: ContentSchedulingWeights = {
  historicalWeight:   0.60,
  industryWeight:     0.40,
  recencyBonus:       0.10,
  peakHourMultiplier: 1.20,
  weekendDiscount:    0.85,
};

/**
 * Parameter bounds for BO.
 * historicalWeight and industryWeight are treated as independent weights
 * (the service normalises them — no sumEquals constraint required).
 */
export const CONTENT_SCHEDULING_BOUNDS: Record<keyof ContentSchedulingWeights, ParameterBounds> = {
  historicalWeight:   { min: 0.10, max: 0.90 },
  industryWeight:     { min: 0.10, max: 0.90 },
  recencyBonus:       { min: 0.00, max: 0.30 },
  peakHourMultiplier: { min: 1.00, max: 1.50 },
  weekendDiscount:    { min: 0.60, max: 1.00 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the content_scheduling surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns CONTENT_SCHEDULING_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getContentSchedulingWeights(
  orgId: string,
): Promise<ContentSchedulingResult> {
  const result = await getOptimisedWeightsOrFallback(
    'content_scheduling',
    orgId,
    () => ({ ...CONTENT_SCHEDULING_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: ContentSchedulingWeights = {
    historicalWeight:   raw.historicalWeight   ?? CONTENT_SCHEDULING_DEFAULTS.historicalWeight,
    industryWeight:     raw.industryWeight     ?? CONTENT_SCHEDULING_DEFAULTS.industryWeight,
    recencyBonus:       raw.recencyBonus       ?? CONTENT_SCHEDULING_DEFAULTS.recencyBonus,
    peakHourMultiplier: raw.peakHourMultiplier ?? CONTENT_SCHEDULING_DEFAULTS.peakHourMultiplier,
    weekendDiscount:    raw.weekendDiscount    ?? CONTENT_SCHEDULING_DEFAULTS.weekendDiscount,
  };

  return { weights, source: result.source };
}
