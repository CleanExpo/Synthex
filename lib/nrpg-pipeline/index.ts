/**
 * lib/nrpg-pipeline — public entry point.
 *
 * The final SYN-834 wiring. Subscribes to ContractorOnboardedEvent
 * and orchestrates: postcode resolve → budget commits → GBP + Bing
 * service-area updates → landing pages → sitemap regen + ping.
 *
 * Per-stage error isolation. Idempotent end-to-end (every stage's
 * own primitive is idempotent on the source-of-truth job ID).
 *
 * @see SYN-834 (epic — final integration)
 * @see lib/nrpg-pipeline/README.md
 */

export type {
  NrpgPipelineHandler,
  NrpgPipelineOptions,
  NrpgPipelineResult,
  StageOutcome,
} from './types';

export { mapNrpgServiceCategories } from './service-category-map';
export { createNrpgPipelineHandler } from './handler';
export { subscribeNrpgPipeline } from './subscriber';
