/**
 * Google Business Profile (GBP) service-area worker types.
 *
 * Foundation primitive for SYN-837 — on every ContractorOnboarded
 * event, diffs the new suburb list against DR's current GBP service-
 * area coverage and PATCHes only the additions.
 *
 * @see SYN-837 (parent: SYN-834 epic)
 * @see lib/gbp/README.md
 */

/**
 * GBP-side representation of an Australian service-area place.
 * Mirrors the shape returned by the GBP locations.serviceArea API.
 */
export interface GbpPlace {
  /** Suburb / locality name as GBP stores it. */
  placeName: string;
  /** GBP-internal place ID (opaque). */
  placeId?: string;
  /** AU postcode if known — used for cross-reference but not by GBP. */
  postcode?: string;
}

/**
 * Result of a GBP service-area read.
 */
export interface GbpServiceAreaSnapshot {
  locationId: string;
  places: GbpPlace[];
  /** ISO timestamp the snapshot was read. */
  readAt: string;
}

/**
 * Input for {@link updateGbpServiceArea} — typically derived from a
 * ContractorOnboardedEvent + postcode-resolver output upstream.
 */
export interface UpdateGbpServiceAreaInput {
  /** GBP location ID for DR's primary listing. */
  locationId: string;
  /** Source-of-truth job ID (Q3.2.4 H8). */
  sourceOfTruthJobId: string;
  /** Contractor whose onboarding triggered the update — for audit. */
  contractorId: string;
  /** Suburb names to add (already passed the postcode resolver). */
  newPlaces: GbpPlace[];
  /** Consent flag from contractor onboarding event. */
  consentGranted: boolean;
  /**
   * Distance-from-base sanity bound. Any place > maxDistanceKm from the
   * contractor's base is dropped before PATCH. Caller computes this
   * from postcode-resolver output and passes the filtered list, OR
   * passes the raw list and lets us short-circuit on the global cap.
   */
  contractorBaseDistanceKmByPlace?: Record<string, number>;
}

/**
 * Result of {@link updateGbpServiceArea}.
 */
export interface UpdateGbpServiceAreaResult {
  /** True iff a PATCH was sent. False iff diff was empty (idempotent). */
  patched: boolean;
  /** Places actually added in this call (post-dedupe + post-distance-filter). */
  added: GbpPlace[];
  /** Places skipped because already in current GBP coverage. */
  skipped: GbpPlace[];
  /** Places dropped for failing the > maxDistanceKm sanity bound. */
  droppedFarFromBase: GbpPlace[];
  /** Reason for refusal — present iff patched=false AND added.length===0. */
  reason?: string;
}

/**
 * Per-call audit row written to foundation-keeper.
 */
export interface GbpAuditEntry {
  sourceOfTruthJobId: string;
  contractorId: string;
  locationId: string;
  placesAdded: GbpPlace[];
  placesSkipped: GbpPlace[];
  patchedAt: string | null;
  reason?: string;
}

/**
 * Function signature for the audit-sink. Pass a noop in tests.
 */
export type GbpAuditSink = (entry: GbpAuditEntry) => Promise<void>;

/**
 * Abstract GBP API client — DI-friendly so we can ship + test without
 * real GBP credentials. Default impl in `gbp-api-client.ts` throws if
 * creds missing; tests inject a fake.
 */
export interface GbpApiClient {
  /** Read the current service-area snapshot for `locationId`. */
  getServiceArea(locationId: string): Promise<GbpServiceAreaSnapshot>;
  /**
   * PATCH the service-area attribute with the new list. Caller is
   * responsible for computing the union (current + additions) — this
   * is a raw write, not a merge.
   */
  patchServiceArea(
    locationId: string,
    nextPlaces: GbpPlace[]
  ): Promise<{ status: number }>;
}

/**
 * Optional configuration overrides.
 */
export interface GbpUpdateOptions {
  /** Inject a custom GBP client (testing). */
  client?: GbpApiClient;
  /** Inject a custom audit sink (testing). */
  audit?: GbpAuditSink;
  /**
   * Per-suburb sanity cap. Default is {@link MAX_DISTANCE_KM_DEFAULT}.
   * Suburbs > this many km from the contractor base are dropped pre-PATCH.
   */
  maxDistanceKm?: number;
}

/**
 * Per-NEVER-list rule: never PATCH GBP with suburbs more than this
 * many km from the contractor's base. Hard sanity bound.
 */
export const MAX_DISTANCE_KM_DEFAULT = 100 as const;
