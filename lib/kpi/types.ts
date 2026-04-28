/**
 * Per-location KPI registration types.
 *
 * Foundation primitive for SYN-842 — performance-attribution-lead snapshots
 * per opened location. Feeds the controlled-retreat decision in the
 * SYN-839 budget ledger.
 *
 * Q3.2.3 A2 binding: AI-search visibility is directional, not a hard KPI.
 * Snapshots default to `verification_state='directional'` until N=30
 * conversions accumulate, then promote to `'verified'`.
 *
 * @see SYN-842 (parent: SYN-834 epic)
 * @see lib/kpi/README.md
 */

/**
 * Allowed period windows. Mirrors the CHECK constraint in
 * `location_kpi.period_days` (see migration 20260429000001).
 */
export type KpiPeriodDays = 7 | 30 | 90;

/**
 * Verification state. Mirrors the CHECK constraint in
 * `location_kpi.verification_state`.
 */
export type KpiVerificationState = 'directional' | 'verified';

/**
 * Persistent KPI snapshot (1:1 with Supabase row).
 */
export interface KpiSnapshot {
  id: string;
  serviceAreaCoverageId: string;
  measuredAt: string;
  periodDays: KpiPeriodDays;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueAud: number;
  verificationState: KpiVerificationState;
  verifiedAt?: string | null;
  createdAt: string;
}

/**
 * Input for {@link recordKpiSnapshot}.
 */
export interface RecordKpiInput {
  serviceAreaCoverageId: string;
  periodDays: KpiPeriodDays;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenueAud?: number;
}

/**
 * Result of {@link recordKpiSnapshot}.
 */
export interface RecordKpiResult {
  snapshot: KpiSnapshot;
  /** True iff the new snapshot triggered a directional → verified promotion. */
  promotedToVerified: boolean;
}

/**
 * A coverage flagged for retreat per the 90-day zero-attribution rule.
 */
export interface RetreatCandidate {
  serviceAreaCoverageId: string;
  latestNinetyDaySnapshot: KpiSnapshot;
}

/**
 * Repository interface — abstracts the Supabase access layer for testing.
 */
export interface KpiRepository {
  /** Insert a snapshot row. Returns the persisted row. */
  insert(
    input: RecordKpiInput & {
      verificationState: KpiVerificationState;
      verifiedAt: string | null;
    }
  ): Promise<KpiSnapshot>;
  /**
   * Most recent snapshot for a coverage at a given period. Returns null if
   * none exist.
   */
  findLatestForCoverage(
    serviceAreaCoverageId: string,
    periodDays?: KpiPeriodDays
  ): Promise<KpiSnapshot | null>;
  /**
   * All snapshots for a coverage, newest first. Useful for trend analysis.
   */
  findAllForCoverage(serviceAreaCoverageId: string): Promise<KpiSnapshot[]>;
  /**
   * Latest 90-day snapshot per coverage across the whole portfolio. Used by
   * the retreat-candidate scan.
   */
  listLatestNinetyDayPerCoverage(): Promise<KpiSnapshot[]>;
}

/**
 * Optional configuration overrides (for testing or per-call overrides).
 */
export interface KpiOptions {
  repository?: KpiRepository;
  /**
   * Override the default conversion threshold for promotion to 'verified'.
   * Defaults to {@link VERIFY_CONVERSIONS_THRESHOLD_DEFAULT}.
   */
  verifyConversionsThreshold?: number;
}

/**
 * Default minimum conversions over a 30-day window required to promote a
 * snapshot from `directional` → `verified`. Aligns with the
 * performance-attribution-lead "N=30" rule.
 */
export const VERIFY_CONVERSIONS_THRESHOLD_DEFAULT = 30 as const;
