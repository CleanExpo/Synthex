/**
 * Bayesian Optimisation Fallback Module
 *
 * Provides graceful degradation when the Python BO service is unavailable.
 * Every optimisation surface has a heuristic fallback.
 *
 * @module lib/bayesian/fallback
 */

import { logger } from '@/lib/logger';
import { getBayesianClient } from './client';
import type { BOSurface } from './types';

export interface WeightResult {
  weights: Record<string, number>;
  source: 'bo' | 'heuristic';
}

/**
 * Try BO-optimised weights, fall back to heuristics if unavailable.
 *
 * @param surface — Which optimisation surface to query
 * @param orgId — Organisation ID (BO state is per-org)
 * @param fallbackFn — Function that returns the default heuristic weights
 */
export async function getOptimisedWeightsOrFallback(
  surface: BOSurface,
  orgId: string,
  fallbackFn: () => Record<string, number>,
): Promise<WeightResult> {
  const client = await getBayesianClient();
  if (!client) {
    return { weights: fallbackFn(), source: 'heuristic' };
  }

  try {
    const spaceId = `${orgId}_${surface}`;
    const suggestion = await client.suggest(spaceId);
    return { weights: suggestion.suggestedParameters, source: 'bo' };
  } catch (error) {
    // Log but don't throw — fall back gracefully
    logger.debug(`BO suggestion unavailable for ${surface}/${orgId}, using heuristic`, { error });
    return { weights: fallbackFn(), source: 'heuristic' };
  }
}

/**
 * Register an observation if the BO service is available.
 * Silently skips if the service is down.
 */
export async function registerObservationSilently(
  surface: BOSurface,
  orgId: string,
  parameters: Record<string, number>,
  target: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const client = await getBayesianClient();
  if (!client) return;

  try {
    const spaceId = `${orgId}_${surface}`;
    await client.observe(spaceId, { parameters, target, metadata });
  } catch {
    // Observation registration is best-effort — don't break the main flow
  }
}
