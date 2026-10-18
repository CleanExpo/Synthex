/**
 * Main entry point for SYN-836 contractor onboarding event.
 *
 * `emitContractorOnboarded(input, opts?)`:
 *   1. Validates input (Q3.2.4 H8 + Q3.2.5 P10 + payment gate + consent gate)
 *   2. Hashes raw address if provided (P10 binding)
 *   3. Builds the canonical event
 *   4. Persists via `opts.persist` (the default store is not provisioned and
 *      throws ContractorOnboardingNotProvisionedError)
 *   5. Notifies all in-process subscribers (per-handler error isolation)
 *   6. Returns EmitResult with notification + idempotency stats
 *
 * Idempotency: relies on the `source_of_truth_job_id UNIQUE` constraint in
 * Supabase (PR #129). Re-emitting the same job ID returns `firstEmit: false`
 * and skips notifying subscribers (they already ran the first time).
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';
import { hashAddress } from './address-hash';
import { notifyContractorOnboarded } from './event-emitter';
import type {
  ContractorOnboardedEvent,
  ContractorOnboardedInput,
  EmitContractorOnboardedOptions,
  EmitResult,
  PersistFn,
} from './types';

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const PERMITTED_BRAND = 'NRPG';

/**
 * Emit a ContractorOnboardedEvent. Validates → persists → notifies.
 *
 * @throws Error on validation failure (input rejected before any side effect).
 *         Persist failures other than UNIQUE conflict propagate up — caller
 *         decides whether to retry.
 */
export async function emitContractorOnboarded(
  input: ContractorOnboardedInput,
  opts: EmitContractorOnboardedOptions = {}
): Promise<EmitResult> {
  validateInput(input);

  const addressHash = resolveAddressHash(input);

  const event: ContractorOnboardedEvent = {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    contractorId: input.contractorId,
    brand: input.brand,
    baseLocation: {
      lat: input.baseLat,
      lng: input.baseLng,
      addressHash,
    },
    radiusKm: input.radiusKm,
    serviceCategories: Object.freeze([...input.serviceCategories]),
    paymentConfirmedAt: input.paymentConfirmedAt,
    consentForServiceAreaListing: true, // validated above
    expectedSuburbCount: input.expectedSuburbCount,
    expectedMonthlyBudgetAud: input.expectedMonthlyBudgetAud,
    emittedAt: new Date().toISOString(),
  };

  const persist = opts.persist ?? defaultPersist;

  const persistResult = await persist(event);
  const firstEmit = persistResult === 'inserted';

  if (!firstEmit) {
    logger.info('[contractor.onboarding] duplicate emit, skipping notify', {
      sourceOfTruthJobId: event.sourceOfTruthJobId,
      contractorId: event.contractorId,
    });
    return {
      firstEmit: false,
      notifiedHandlers: 0,
      failedHandlers: 0,
      event,
    };
  }

  logger.info('[contractor.onboarding] emit', {
    sourceOfTruthJobId: event.sourceOfTruthJobId,
    contractorId: event.contractorId,
    brand: event.brand,
    radiusKm: event.radiusKm,
    serviceCategoryCount: event.serviceCategories.length,
    expectedSuburbCount: event.expectedSuburbCount ?? null,
    expectedMonthlyBudgetAud: event.expectedMonthlyBudgetAud ?? null,
    // Note: addressHash is logged (acceptable per design — it's already hashed)
    addressHash: event.baseLocation.addressHash.slice(0, 12),
  });

  const { notified, failed } = await notifyContractorOnboarded(event);

  return {
    firstEmit: true,
    notifiedHandlers: notified,
    failedHandlers: failed,
    event,
  };
}

// ─── VALIDATION ───────────────────────────────────────────────────────────

function validateInput(input: ContractorOnboardedInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('emitContractorOnboarded: input is required');
  }
  if (
    !input.sourceOfTruthJobId ||
    typeof input.sourceOfTruthJobId !== 'string'
  ) {
    throw new Error(
      'emitContractorOnboarded: sourceOfTruthJobId required (Q3.2.4 H8)'
    );
  }
  if (!input.contractorId || typeof input.contractorId !== 'string') {
    throw new Error('emitContractorOnboarded: contractorId required');
  }
  if (input.brand !== PERMITTED_BRAND) {
    throw new Error(
      `emitContractorOnboarded: brand must be '${PERMITTED_BRAND}' (got '${input.brand}'). Other brands have separate flows per Phase 3.4.`
    );
  }
  if (
    !Number.isFinite(input.baseLat) ||
    input.baseLat < -90 ||
    input.baseLat > 90
  ) {
    throw new Error(
      `emitContractorOnboarded: baseLat must be a finite number in [-90, 90] (got ${input.baseLat})`
    );
  }
  if (
    !Number.isFinite(input.baseLng) ||
    input.baseLng < -180 ||
    input.baseLng > 180
  ) {
    throw new Error(
      `emitContractorOnboarded: baseLng must be a finite number in [-180, 180] (got ${input.baseLng})`
    );
  }
  if (
    !Number.isFinite(input.radiusKm) ||
    input.radiusKm < MIN_RADIUS_KM ||
    input.radiusKm > MAX_RADIUS_KM
  ) {
    throw new Error(
      `emitContractorOnboarded: radiusKm must be a finite number in [${MIN_RADIUS_KM}, ${MAX_RADIUS_KM}] (got ${input.radiusKm})`
    );
  }
  if (
    !Array.isArray(input.serviceCategories) ||
    input.serviceCategories.length === 0
  ) {
    throw new Error(
      'emitContractorOnboarded: serviceCategories must be a non-empty array'
    );
  }
  if (
    !input.paymentConfirmedAt ||
    typeof input.paymentConfirmedAt !== 'string'
  ) {
    throw new Error(
      'emitContractorOnboarded: paymentConfirmedAt required (no payment = no event)'
    );
  }
  if (Number.isNaN(Date.parse(input.paymentConfirmedAt))) {
    throw new Error(
      `emitContractorOnboarded: paymentConfirmedAt must be a parseable ISO date (got '${input.paymentConfirmedAt}')`
    );
  }
  if (input.consentForServiceAreaListing !== true) {
    throw new Error(
      'emitContractorOnboarded: consentForServiceAreaListing must be true (coverage cannot open without consent)'
    );
  }
  if (!input.rawAddress && !input.addressHash) {
    throw new Error(
      'emitContractorOnboarded: one of rawAddress or addressHash is required (Q3.2.5 P10)'
    );
  }
  if (input.rawAddress && input.addressHash) {
    throw new Error(
      'emitContractorOnboarded: provide either rawAddress OR addressHash, not both'
    );
  }
}

function resolveAddressHash(input: ContractorOnboardedInput): string {
  if (input.addressHash) {
    if (
      typeof input.addressHash !== 'string' ||
      input.addressHash.length < 32
    ) {
      throw new Error(
        'emitContractorOnboarded: addressHash must be a hex string ≥ 32 chars'
      );
    }
    return input.addressHash;
  }
  // rawAddress was validated above as present
  return hashAddress(input.rawAddress!);
}

// ─── DEFAULT PERSISTENCE (not provisioned) ────────────────────────────────

/**
 * Thrown by the default persist: the `contractor_onboarding_event` table has
 * no Prisma model, so there is nowhere real to write the event. Inject
 * `opts.persist` to supply a real store.
 */
export class ContractorOnboardingNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'contractor_onboarding_event';

  constructor() {
    super(
      'contractor_onboarding_event is not provisioned: no table in prisma/schema.prisma, event not persisted'
    );
    this.name = 'ContractorOnboardingNotProvisionedError';
  }
}

/**
 * Default persist. The backing table is not provisioned, so it throws a
 * {@link ContractorOnboardingNotProvisionedError} instead of pretending the
 * write happened. Subscribers are therefore never notified for an event that
 * was not stored.
 */
const defaultPersist: PersistFn = async event => {
  logger.warn('[contractor.onboarding] persist not provisioned', {
    sourceOfTruthJobId: event.sourceOfTruthJobId,
  });
  throw new ContractorOnboardingNotProvisionedError();
};
