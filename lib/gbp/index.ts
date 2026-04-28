/**
 * lib/gbp — public entry point.
 *
 * SYN-837 DR Google Business Profile service-area updater. Subscribes
 * to ContractorOnboarded events and PATCHes only newly-discovered
 * suburbs (idempotent, dedupe-against-current, source-of-truth job
 * ID propagated, consent gate, distance sanity bound).
 *
 * @see SYN-837 (parent: SYN-834 epic)
 * @see lib/gbp/README.md
 */

export { MAX_DISTANCE_KM_DEFAULT } from './types';

export type {
  GbpApiClient,
  GbpAuditEntry,
  GbpAuditSink,
  GbpPlace,
  GbpServiceAreaSnapshot,
  GbpUpdateOptions,
  UpdateGbpServiceAreaInput,
  UpdateGbpServiceAreaResult,
} from './types';

export { gbpApiClient, noopGbpAuditSink } from './gbp-api-client';

export { updateGbpServiceArea } from './service-area-updater';
