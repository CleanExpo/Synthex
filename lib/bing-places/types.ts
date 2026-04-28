/**
 * Bing Places per-location sync types.
 *
 * Foundation primitive for SYN-841 — mirrors the SYN-837 GBP work for
 * Bing's index. Per the SEO/AEO/GEO research transcript: ChatGPT uses
 * Bing's web index, so keeping Bing Places in sync with GBP service-
 * area updates means RA citations from ChatGPT pick up new locations.
 *
 * @see SYN-841 (parent: SYN-834 epic)
 * @see lib/bing-places/README.md
 */

/**
 * Bing-side representation of a service-area locality.
 */
export interface BingLocality {
  /** Suburb / locality name as Bing stores it. */
  name: string;
  /** AU postcode if known — used for cross-reference, not by Bing API. */
  postcode?: string;
}

/**
 * Result of a Bing Places service-area read.
 */
export interface BingServiceAreaSnapshot {
  storeId: string;
  localities: BingLocality[];
  /** ISO timestamp the snapshot was read. */
  readAt: string;
}

/**
 * Input for {@link updateBingServiceArea} — typically derived from a
 * ContractorOnboardedEvent + postcode-resolver output upstream.
 */
export interface UpdateBingServiceAreaInput {
  /** Bing Places store ID for DR's primary listing. */
  storeId: string;
  /** Source-of-truth job ID (Q3.2.4 H8). */
  sourceOfTruthJobId: string;
  /** Contractor whose onboarding triggered the update — for audit. */
  contractorId: string;
  /** Localities to add (already passed the postcode resolver). */
  newLocalities: BingLocality[];
  /** Consent flag from contractor onboarding event. */
  consentGranted: boolean;
  /**
   * Per-locality distance from contractor base (km). Used by the
   * sanity filter to drop > maxDistanceKm.
   */
  contractorBaseDistanceKmByLocality?: Record<string, number>;
}

/**
 * Result of {@link updateBingServiceArea}.
 */
export interface UpdateBingServiceAreaResult {
  /** True iff a PUT was sent. False iff diff was empty (idempotent). */
  synced: boolean;
  /** Localities actually added in this call (post-dedupe + post-distance-filter). */
  added: BingLocality[];
  /** Localities skipped because already in current Bing coverage. */
  skipped: BingLocality[];
  /** Localities dropped for failing the > maxDistanceKm sanity bound. */
  droppedFarFromBase: BingLocality[];
  /** Reason for refusal — present iff synced=false AND added.length===0. */
  reason?: string;
}

/**
 * Per-call audit row.
 */
export interface BingPlacesAuditEntry {
  sourceOfTruthJobId: string;
  contractorId: string;
  storeId: string;
  localitiesAdded: BingLocality[];
  localitiesSkipped: BingLocality[];
  syncedAt: string | null;
  reason?: string;
}

/**
 * Function signature for the audit-sink. Pass a noop in tests.
 */
export type BingPlacesAuditSink = (
  entry: BingPlacesAuditEntry
) => Promise<void>;

/**
 * Abstract Bing Places API client — DI-friendly so we can ship + test
 * without real Bing credentials.
 */
export interface BingPlacesApiClient {
  /** Read the current service-area snapshot for `storeId`. */
  getServiceArea(storeId: string): Promise<BingServiceAreaSnapshot>;
  /**
   * PUT the service-area localities. Caller is responsible for
   * computing the union (current + additions) — this is a raw write.
   */
  putServiceArea(
    storeId: string,
    nextLocalities: BingLocality[]
  ): Promise<{ status: number }>;
}

/**
 * Optional configuration overrides.
 */
export interface BingPlacesUpdateOptions {
  client?: BingPlacesApiClient;
  audit?: BingPlacesAuditSink;
  maxDistanceKm?: number;
}

/**
 * Per-NEVER-list rule (mirrors SYN-837): never sync localities more
 * than this many km from the contractor's base. Hard sanity bound.
 */
export const MAX_DISTANCE_KM_DEFAULT = 100 as const;
