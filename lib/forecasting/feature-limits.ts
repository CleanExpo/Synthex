/**
 * Forecasting Feature Limits
 *
 * Per-plan usage limits for Prophet and BayesNF features.
 * Follows the pattern from lib/bayesian/feature-limits.ts.
 *
 * PRICING (from CLAUDE.md — DO NOT CHANGE WITHOUT APPROVAL):
 * - Pro: $249/month
 * - Growth: $449/month
 * - Scale: $799/month
 *
 * @module lib/forecasting/feature-limits
 */

import type { ForecastHorizon } from './types';

export interface ForecastFeatureLimits {
  forecastModels: number;             // Total Prophet models per org
  monthlyForecasts: number;           // Forecast predictions per month
  maxHorizonDays: ForecastHorizon;    // Maximum forecast horizon
  spatiotemporalModels: number;       // BayesNF models per org
  monthlyPredictions: number;         // BayesNF predictions per month
  crossPlatformHeatmap: boolean;      // BayesNF cross-platform visualisation
}

/**
 * Feature limits by subscription plan.
 * -1 = unlimited
 */
export const FORECAST_PLAN_LIMITS: Record<string, ForecastFeatureLimits> = {
  free: {
    forecastModels: 0,
    monthlyForecasts: 0,
    maxHorizonDays: 7,
    spatiotemporalModels: 0,
    monthlyPredictions: 0,
    crossPlatformHeatmap: false,
  },
  pro: {
    forecastModels: 3,
    monthlyForecasts: 10,
    maxHorizonDays: 7,
    spatiotemporalModels: 0,
    monthlyPredictions: 0,
    crossPlatformHeatmap: false,
  },
  growth: {
    forecastModels: 15,
    monthlyForecasts: 100,
    maxHorizonDays: 30,
    spatiotemporalModels: 2,
    monthlyPredictions: 25,
    crossPlatformHeatmap: false,
  },
  scale: {
    forecastModels: -1,
    monthlyForecasts: -1,
    maxHorizonDays: 90,
    spatiotemporalModels: -1,
    monthlyPredictions: -1,
    crossPlatformHeatmap: true,
  },
};

/**
 * Get forecast feature limits for a plan.
 */
export function getForecastFeatureLimits(plan: string): ForecastFeatureLimits {
  return FORECAST_PLAN_LIMITS[plan] ?? FORECAST_PLAN_LIMITS.free;
}

/**
 * Check if a numeric forecast feature is within the plan limit.
 * @returns true if within limit, false if exceeded
 */
export function isWithinForecastLimit(
  plan: string,
  field: keyof Omit<ForecastFeatureLimits, 'maxHorizonDays' | 'crossPlatformHeatmap'>,
  currentUsage: number,
): boolean {
  const limits = getForecastFeatureLimits(plan);
  const limit = limits[field];
  if (limit === -1) return true; // unlimited
  return currentUsage < limit;
}

/**
 * Check if the requested horizon is allowed on the plan.
 */
export function isHorizonAllowed(plan: string, horizonDays: number): boolean {
  const limits = getForecastFeatureLimits(plan);
  return horizonDays <= limits.maxHorizonDays;
}

/**
 * Check if BayesNF (spatiotemporal) is available on the plan.
 */
export function isSpatiotemporalAvailable(plan: string): boolean {
  const limits = getForecastFeatureLimits(plan);
  return limits.spatiotemporalModels !== 0;
}
