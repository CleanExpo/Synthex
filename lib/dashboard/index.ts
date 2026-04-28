/**
 * lib/dashboard — public entry point.
 *
 * SYN-843 admin dashboard data layer for the SYN-834 NRPG → DR
 * pipeline. Aggregates coverage + budget + KPI into a single typed
 * snapshot the admin UI consumes; ships a CSV serialiser for the
 * monthly board-pack export.
 *
 * @see SYN-843 (parent: SYN-834 epic)
 * @see lib/dashboard/README.md
 */

export type {
  ContractorCoverageSummary,
  CoverageRepository,
  CoverageStatus,
  DashboardLocationRow,
  NrpgCoverageSnapshot,
  ServiceAreaCoverage,
  SnapshotOptions,
} from './types';

export { supabaseCoverageRepository } from './supabase-coverage-repository';

export { getNrpgCoverageSnapshot } from './coverage-snapshot';

export { snapshotToCsv } from './csv-export';
