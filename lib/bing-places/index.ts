/**
 * lib/bing-places — public entry point.
 *
 * SYN-841 — keeps DR's Bing Places listing in sync with GBP service-
 * area updates so RA citations from ChatGPT (which uses Bing's index)
 * pick up new locations.
 *
 * @see SYN-841 (parent: SYN-834 epic)
 * @see lib/bing-places/README.md
 */

export { MAX_DISTANCE_KM_DEFAULT } from './types';

export type {
  BingLocality,
  BingPlacesApiClient,
  BingPlacesAuditEntry,
  BingPlacesAuditSink,
  BingPlacesUpdateOptions,
  BingServiceAreaSnapshot,
  UpdateBingServiceAreaInput,
  UpdateBingServiceAreaResult,
} from './types';

export {
  bingPlacesApiClient,
  noopBingPlacesAuditSink,
} from './bing-api-client';

export { updateBingServiceArea } from './service-area-sync';
