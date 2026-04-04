/**
 * Bayesian Optimisation Surface Adapter — Self-Healing Priority
 *
 * Provides BO-optimised ordering weights for self-healer fix suggestions.
 * Higher weight = the issue type appears earlier in the returned issues list.
 *
 * Surface: 'self_healing_priority'
 * Dimensions: one priority weight per HealingIssueType (8 total)
 *
 * @module lib/bayesian/surfaces/self-healing-priority
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SelfHealingPriorityWeights {
  missingMetaPriority:     number; // 0.05 – 0.40
  brokenSchemaPriority:    number; // 0.05 – 0.40
  lowGeoScorePriority:     number; // 0.05 – 0.40
  lowQualityScorePriority: number; // 0.05 – 0.40
  missingEntityPriority:   number; // 0.05 – 0.40
  shortTitlePriority:      number; // 0.05 – 0.40
  missingH1Priority:       number; // 0.05 – 0.40
  weakMetaDescPriority:    number; // 0.05 – 0.40
}

export interface SelfHealingPriorityResult {
  weights: SelfHealingPriorityWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — reflect the critical/warning severity weighting
 * already implicit in the existing rule order in self-healer.ts.
 * No sumEquals constraint — each is an independent priority weight.
 */
export const SELF_HEALING_PRIORITY_DEFAULTS: SelfHealingPriorityWeights = {
  missingMetaPriority:     0.20,
  brokenSchemaPriority:    0.15,
  lowGeoScorePriority:     0.20,
  lowQualityScorePriority: 0.15,
  missingEntityPriority:   0.10,
  shortTitlePriority:      0.10,
  missingH1Priority:       0.05,
  weakMetaDescPriority:    0.05,
};

export const SELF_HEALING_PRIORITY_BOUNDS: Record<keyof SelfHealingPriorityWeights, ParameterBounds> = {
  missingMetaPriority:     { min: 0.05, max: 0.40 },
  brokenSchemaPriority:    { min: 0.05, max: 0.40 },
  lowGeoScorePriority:     { min: 0.05, max: 0.40 },
  lowQualityScorePriority: { min: 0.05, max: 0.40 },
  missingEntityPriority:   { min: 0.05, max: 0.40 },
  shortTitlePriority:      { min: 0.05, max: 0.40 },
  missingH1Priority:       { min: 0.05, max: 0.40 },
  weakMetaDescPriority:    { min: 0.05, max: 0.40 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the self_healing_priority surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns SELF_HEALING_PRIORITY_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getSelfHealingPriorityWeights(
  orgId: string,
): Promise<SelfHealingPriorityResult> {
  const result = await getOptimisedWeightsOrFallback(
    'self_healing_priority',
    orgId,
    () => ({ ...SELF_HEALING_PRIORITY_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: SelfHealingPriorityWeights = {
    missingMetaPriority:     raw.missingMetaPriority     ?? SELF_HEALING_PRIORITY_DEFAULTS.missingMetaPriority,
    brokenSchemaPriority:    raw.brokenSchemaPriority    ?? SELF_HEALING_PRIORITY_DEFAULTS.brokenSchemaPriority,
    lowGeoScorePriority:     raw.lowGeoScorePriority     ?? SELF_HEALING_PRIORITY_DEFAULTS.lowGeoScorePriority,
    lowQualityScorePriority: raw.lowQualityScorePriority ?? SELF_HEALING_PRIORITY_DEFAULTS.lowQualityScorePriority,
    missingEntityPriority:   raw.missingEntityPriority   ?? SELF_HEALING_PRIORITY_DEFAULTS.missingEntityPriority,
    shortTitlePriority:      raw.shortTitlePriority      ?? SELF_HEALING_PRIORITY_DEFAULTS.shortTitlePriority,
    missingH1Priority:       raw.missingH1Priority       ?? SELF_HEALING_PRIORITY_DEFAULTS.missingH1Priority,
    weakMetaDescPriority:    raw.weakMetaDescPriority    ?? SELF_HEALING_PRIORITY_DEFAULTS.weakMetaDescPriority,
  };

  return { weights, source: result.source };
}
