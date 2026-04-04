/**
 * Bayesian Optimisation Module
 *
 * Public exports for the BO parameter optimisation engine.
 *
 * @module lib/bayesian
 */

export * from './types';
export { getBayesianClient, getBayesianClientDirect } from './client';
export { getOptimisedWeightsOrFallback, registerObservationSilently } from './fallback';
export { getBOFeatureLimits, isSurfaceAvailable, isWithinBOLimit, BO_PLAN_LIMITS } from './feature-limits';
export type { BOFeatureLimits } from './feature-limits';
