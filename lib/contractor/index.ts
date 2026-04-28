/**
 * lib/contractor — public entry point.
 *
 * SYN-836 contractor onboarding event for the SYN-834 NRPG → DR dynamic
 * service-area expansion pipeline.
 *
 * Usage:
 * ```ts
 * import {
 *   emitContractorOnboarded,
 *   subscribeContractorOnboarded,
 * } from '@/lib/contractor';
 *
 * // Subscribe (in a worker module)
 * const unsubscribe = subscribeContractorOnboarded(async event => {
 *   // … react to the event …
 * });
 *
 * // Emit (in the onboarding API route, after payment confirmation)
 * const result = await emitContractorOnboarded({
 *   sourceOfTruthJobId: 'nrpg_onboarding_job_2026_04_29_0042',
 *   contractorId: 'contractor_abc',
 *   brand: 'NRPG',
 *   baseLat: -27.4705,
 *   baseLng: 153.026,
 *   rawAddress: '123 Smith St, Brisbane QLD 4000',
 *   radiusKm: 20,
 *   serviceCategories: ['water-damage', 'fire-restoration'],
 *   paymentConfirmedAt: new Date().toISOString(),
 *   consentForServiceAreaListing: true,
 * });
 * ```
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

export type {
  ContractorOnboardedEvent,
  ContractorOnboardedHandler,
  ContractorOnboardedInput,
  ContractorOnboardingBrand,
  EmitContractorOnboardedOptions,
  EmitResult,
  PersistFn,
  Subscription,
} from './types';

export { hashAddress, normaliseAddress } from './address-hash';

export {
  subscribeContractorOnboarded,
  notifyContractorOnboarded,
  _resetContractorEventSubscribersForTests,
  _getContractorEventSubscriberCountForTests,
} from './event-emitter';

export { emitContractorOnboarded } from './onboarding-event';
