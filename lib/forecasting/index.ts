/**
 * Forecasting Module
 *
 * Public exports for Prophet time-series forecasting
 * and BayesNF spatiotemporal prediction.
 *
 * @module lib/forecasting
 */

export * from './types';
export { getForecastingClient } from './client';
export { FORECAST_METRICS, getMetricDefinition, getMetricsForPlatform, getAggregateMetrics } from './metrics';
export type { MetricDefinition } from './metrics';
export {
  getForecastFeatureLimits,
  isWithinForecastLimit,
  isHorizonAllowed,
  isSpatiotemporalAvailable,
  FORECAST_PLAN_LIMITS,
} from './feature-limits';
export type { ForecastFeatureLimits } from './feature-limits';
