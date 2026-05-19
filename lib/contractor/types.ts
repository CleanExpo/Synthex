/**
 * Contractor onboarding event types
 *
 * Foundation primitive for SYN-834 NRPG → DR dynamic service-area pipeline.
 * Q3.2.4 H8: every event carries a source-of-truth job ID.
 * Q3.2.5 P10: raw address NEVER stored — addressHash only.
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

/**
 * Brand discriminator. NRPG is currently the only brand that emits this
 * event (per Phase 3.4 carve-out — DR/RA/CARSI/external client have separate flows).
 */
export type ContractorOnboardingBrand = 'NRPG';

/**
 * Input shape for {@link emitContractorOnboarded}.
 *
 * One of `rawAddress` or `addressHash` MUST be provided. If `rawAddress`
 * is supplied, it is hashed in-memory and discarded — never persisted, never
 * logged (Q3.2.5 P10 binding).
 */
export interface ContractorOnboardedInput {
  /** Q3.2.4 H8 source-of-truth job ID. Must be unique per onboarding. */
  sourceOfTruthJobId: string;
  /** Pseudonymous contractor identifier. */
  contractorId: string;
  /** Always 'NRPG' for this flow. */
  brand: ContractorOnboardingBrand;
  /** Base location latitude in WGS84 decimal degrees · -90 to 90. */
  baseLat: number;
  /** Base location longitude in WGS84 decimal degrees · -180 to 180. */
  baseLng: number;
  /**
   * Raw street address. If provided, hashed in-memory and discarded.
   * NEVER persisted, NEVER logged. P10 binding.
   * Provide this OR `addressHash`, not both.
   */
  rawAddress?: string;
  /**
   * Pre-computed sha256 hex of normalised raw address. Use when caller has
   * already done the hash (e.g. raw address is in another upstream system).
   */
  addressHash?: string;
  /** Coverage radius in km. 1-200 inclusive. */
  radiusKm: number;
  /**
   * Service categories the contractor onboards for. e.g.
   * `['water-damage', 'fire-restoration', 'mould-remediation']`.
   */
  serviceCategories: string[];
  /** ISO 8601 timestamp when payment confirmed. Required (no payment = no event). */
  paymentConfirmedAt: string;
  /**
   * Contractor consented to public service-area listing. Required true.
   * If false, the event throws — coverage cannot open without consent.
   */
  consentForServiceAreaListing: boolean;
  /** Optional: pre-computed suburb count from {@link resolveSuburbsWithinRadius}. */
  expectedSuburbCount?: number;
  /** Optional: pre-computed monthly budget commitment (suburb count × $55). */
  expectedMonthlyBudgetAud?: number;
}

/**
 * Canonical event shape published to subscribers.
 * `rawAddress` has been replaced by `addressHash`. Both are required on the event.
 */
export interface ContractorOnboardedEvent {
  sourceOfTruthJobId: string;
  contractorId: string;
  brand: ContractorOnboardingBrand;
  baseLocation: {
    lat: number;
    lng: number;
    addressHash: string;
  };
  radiusKm: number;
  serviceCategories: ReadonlyArray<string>;
  paymentConfirmedAt: string;
  consentForServiceAreaListing: true;
  expectedSuburbCount?: number;
  expectedMonthlyBudgetAud?: number;
  /** ISO 8601 timestamp when emitted. Set by emitter. */
  emittedAt: string;
}

/**
 * Subscriber callback. Receives the event, returns a promise (or sync value).
 * Errors thrown by handlers are caught and logged — they do not break sibling
 * subscribers or the emitter itself.
 */
export type ContractorOnboardedHandler = (
  event: ContractorOnboardedEvent
) => void | Promise<void>;

/**
 * Returned by {@link subscribeContractorOnboarded}. Call to unsubscribe.
 */
export type Subscription = () => void;

/**
 * Persistence function. Writes an emitted event to durable storage.
 * Returns `'inserted'` on first write, `'duplicate'` if the
 * `sourceOfTruthJobId` already exists (idempotent re-emit), or throws.
 */
export type PersistFn = (
  event: ContractorOnboardedEvent
) => Promise<'inserted' | 'duplicate'>;

/**
 * Result returned by {@link emitContractorOnboarded}.
 */
export interface EmitResult {
  /** True iff this was the first emission for this sourceOfTruthJobId. */
  firstEmit: boolean;
  /** Number of subscribers that received the event. */
  notifiedHandlers: number;
  /** Number of subscriber handlers that threw (caught and logged, not propagated). */
  failedHandlers: number;
  /** The event itself (for inspection). */
  event: ContractorOnboardedEvent;
}

/**
 * Optional emitter configuration.
 */
export interface EmitContractorOnboardedOptions {
  /**
   * Persistence override. Default: writes to Supabase
   * `contractor_onboarding_event` table via the service-role client.
   * Tests inject a mock to avoid network/DB calls.
   */
  persist?: PersistFn;
}
