/**
 * NRPG → DR pipeline subscriber wiring.
 *
 *   subscribeNrpgPipeline(opts) → unsubscribe()
 *
 * Single call wires the integration handler onto the
 * subscribeContractorOnboarded primitive from lib/contractor.
 *
 * @see SYN-834 (epic — final integration)
 */

import { logger } from '@/lib/logger';
import {
  subscribeContractorOnboarded,
  type Subscription,
} from '@/lib/contractor';
import { createNrpgPipelineHandler } from './handler';
import type { NrpgPipelineOptions } from './types';

/**
 * Wire the integration handler onto the in-process contractor-event
 * bus. Returns the standard {@link Subscription} unsubscribe closure.
 */
export function subscribeNrpgPipeline(opts: NrpgPipelineOptions): Subscription {
  const handler = createNrpgPipelineHandler(opts);
  return subscribeContractorOnboarded(async event => {
    const result = await handler(event);
    if (!result.accepted) {
      logger.info('[nrpg-pipeline] event refused', {
        sourceOfTruthJobId: result.sourceOfTruthJobId,
        contractorId: result.contractorId,
        reason: result.reason,
      });
      return;
    }
    logger.info('[nrpg-pipeline] event processed', {
      sourceOfTruthJobId: result.sourceOfTruthJobId,
      contractorId: result.contractorId,
      postcodeOk: result.postcodeResolve?.ok,
      budgetOk: result.budgetCommits?.ok,
      gbpOk: result.gbp?.ok,
      bingOk: result.bingPlaces?.ok,
      landingOk: result.landingPages?.ok,
      sitemapOk: result.sitemap?.ok,
      durationMs: {
        postcode: result.postcodeResolve?.durationMs,
        budget: result.budgetCommits?.durationMs,
        gbp: result.gbp?.durationMs,
        bing: result.bingPlaces?.durationMs,
        landing: result.landingPages?.durationMs,
        sitemap: result.sitemap?.durationMs,
      },
    });
  });
}
