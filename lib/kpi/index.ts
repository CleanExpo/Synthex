/**
 * lib/kpi — public entry point.
 *
 * SYN-842 per-location KPI registration for the SYN-834 NRPG → DR pipeline.
 * Records performance-attribution snapshots, promotes to verified at N=30
 * conversions, surfaces 90-day zero-attribution retreat candidates.
 *
 * @see SYN-842 (parent: SYN-834 epic)
 * @see lib/kpi/README.md
 */

export { VERIFY_CONVERSIONS_THRESHOLD_DEFAULT } from './types';

export type {
  KpiOptions,
  KpiPeriodDays,
  KpiRepository,
  KpiSnapshot,
  KpiVerificationState,
  RecordKpiInput,
  RecordKpiResult,
  RetreatCandidate,
} from './types';

export { supabaseKpiRepository } from './supabase-repository';

export {
  recordKpiSnapshot,
  getLatestSnapshot,
  getCoverageKpiHistory,
  getRetreatCandidates,
} from './per-location-kpi';
