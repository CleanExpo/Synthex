/**
 * Bayesian Optimisation Feature Limits
 *
 * Per-plan usage limits for all AI intelligence features.
 * Follows the pattern from lib/geo/feature-limits.ts.
 *
 * PRICING (from CLAUDE.md — DO NOT CHANGE WITHOUT APPROVAL):
 * - Pro: $249/month
 * - Growth: $449/month
 * - Scale: $799/month
 *
 * @module lib/bayesian/feature-limits
 */

import type { BOSurface } from './types';

export interface BOFeatureLimits {
  optimisationSpaces: number;     // Total active spaces per org
  monthlyOptimisations: number;   // Full maximise runs per month
  monthlySuggestions: number;     // Individual suggest calls per month
  surfaces: BOSurface[];          // Which surfaces are available
}

/**
 * Feature limits by subscription plan.
 * -1 = unlimited
 */
export const BO_PLAN_LIMITS: Record<string, BOFeatureLimits> = {
  free: {
    optimisationSpaces: 0,
    monthlyOptimisations: 0,
    monthlySuggestions: 0,
    surfaces: [],
  },
  pro: {
    optimisationSpaces: 2,
    monthlyOptimisations: 5,
    monthlySuggestions: 50,
    surfaces: ['geo_score_weights', 'tactic_weights'],
  },
  growth: {
    optimisationSpaces: 10,
    monthlyOptimisations: 25,
    monthlySuggestions: -1,
    surfaces: [
      'geo_score_weights',
      'tactic_weights',
      'experiment_sampling',
      'content_scheduling',
      'prompt_testing',
      'backlink_scoring',
    ],
  },
  scale: {
    optimisationSpaces: -1,
    monthlyOptimisations: -1,
    monthlySuggestions: -1,
    surfaces: [
      'geo_score_weights',
      'tactic_weights',
      'experiment_sampling',
      'content_scheduling',
      'prompt_testing',
      'backlink_scoring',
      'authority_validation',
      'psychology_levers',
      'self_healing_priority',
      'campaign_roi',
    ],
  },
};

/**
 * Get feature limits for a plan.
 */
export function getBOFeatureLimits(plan: string): BOFeatureLimits {
  return BO_PLAN_LIMITS[plan] ?? BO_PLAN_LIMITS.free;
}

/**
 * Check if a surface is available on the given plan.
 */
export function isSurfaceAvailable(plan: string, surface: BOSurface): boolean {
  const limits = getBOFeatureLimits(plan);
  return limits.surfaces.includes(surface);
}

/**
 * Check if usage is within the plan limit.
 * @returns true if within limit, false if exceeded
 */
export function isWithinBOLimit(
  plan: string,
  field: keyof Omit<BOFeatureLimits, 'surfaces'>,
  currentUsage: number,
): boolean {
  const limits = getBOFeatureLimits(plan);
  const limit = limits[field];
  if (limit === -1) return true; // unlimited
  return currentUsage < limit;
}
