/**
 * Admin dashboard data-layer types.
 *
 * Foundation primitive for SYN-843 — aggregates the SYN-834 NRPG → DR
 * pipeline state into a single typed snapshot the admin UI consumes.
 * Keeps the UI layer dumb (it just renders the snapshot) and the
 * aggregation logic testable (no React, no map library, no fetch).
 *
 * Phase 3.4 cross-portfolio boundary: this module ONLY surfaces DR
 * (Nexus brand) data. Caller is responsible for not mixing external client
 * coverage in. Single-brand-by-construction reduces the chance of
 * an accidental data leak across the boundary.
 *
 * Q3.2.5 P10: contractor PII never appears in the snapshot. Only
 * pseudonymous contractor IDs, never names or contact details.
 *
 * @see SYN-843 (parent: SYN-834 epic)
 * @see lib/dashboard/README.md
 */

import type { LedgerEntry, MonthlyUtilisation } from '@/lib/budget';
import type { KpiSnapshot, RetreatCandidate } from '@/lib/kpi';

/**
 * Coverage status mirrors the DB CHECK on `service_area_coverage.status`.
 */
export type CoverageStatus = 'active' | 'paused' | 'retreated' | 'closed';

/**
 * One row from the service_area_coverage table.
 */
export interface ServiceAreaCoverage {
  id: string;
  brand: 'DR';
  postcode: string;
  suburb: string;
  state: string;
  openedByContractorId: string;
  openedAt: string;
  closedAt?: string | null;
  status: CoverageStatus;
  gbpUpdatedAt?: string | null;
  bingUpdatedAt?: string | null;
  sourceOfTruthJobId: string;
  createdAt: string;
}

/**
 * One contractor's aggregated coverage view (count of locations +
 * monthly spend). NEVER carries the contractor's name or phone — only
 * the pseudonymous ID.
 */
export interface ContractorCoverageSummary {
  contractorId: string;
  activeLocationCount: number;
  pausedLocationCount: number;
  monthlyAud: number;
}

/**
 * Per-location row joined across coverage + budget + latest KPI snapshot.
 * Drives the map pins + table rows in the admin UI.
 */
export interface DashboardLocationRow {
  serviceAreaCoverageId: string;
  suburb: string;
  postcode: string;
  status: CoverageStatus;
  openedByContractorId: string;
  openedAt: string;
  monthlyAud: number;
  /** Latest 30-day snapshot if any. */
  latestThirtyDayKpi?: KpiSnapshot;
  /** Latest 90-day snapshot if any. */
  latestNinetyDayKpi?: KpiSnapshot;
  /** True iff the latest 90d snapshot is on the retreat list. */
  flaggedForRetreat: boolean;
}

/**
 * Full snapshot returned by {@link getNrpgCoverageSnapshot}. Single
 * round-trip for the dashboard page.
 */
export interface NrpgCoverageSnapshot {
  /** ISO timestamp the snapshot was assembled. */
  generatedAt: string;
  /** Portfolio-wide budget utilisation. */
  monthlyBudget: MonthlyUtilisation;
  /** Per-location rows (joined coverage + ledger + KPI). */
  locations: DashboardLocationRow[];
  /** Per-contractor aggregates. */
  contractors: ContractorCoverageSummary[];
  /** 90-day zero-attribution candidates from lib/kpi. */
  retreatCandidates: RetreatCandidate[];
  /** Counts by status — for header badges. */
  counts: Record<CoverageStatus | 'total', number>;
}

/**
 * Repository over `service_area_coverage`. DI-friendly so tests don't
 * hit Supabase.
 */
export interface CoverageRepository {
  /** All coverages for DR (single-brand-by-construction). */
  findAllForDr(): Promise<ServiceAreaCoverage[]>;
}

/**
 * Optional configuration overrides for the snapshot aggregator.
 * Each field has a default backed by the corresponding lib.
 */
export interface SnapshotOptions {
  coverageRepo?: CoverageRepository;
  /**
   * Caller-supplied alternate ledger / kpi loaders so the snapshot
   * can be built from injected fakes in tests. If omitted, the
   * defaults from `@/lib/budget` and `@/lib/kpi` are used (which in
   * turn use Supabase service-role).
   */
  loadLedgerForContractor?: (contractorId: string) => Promise<LedgerEntry[]>;
  loadMonthlyBudget?: () => Promise<MonthlyUtilisation>;
  loadLatestKpi?: (
    serviceAreaCoverageId: string,
    periodDays: 30 | 90
  ) => Promise<KpiSnapshot | null>;
  loadRetreatCandidates?: () => Promise<RetreatCandidate[]>;
}
