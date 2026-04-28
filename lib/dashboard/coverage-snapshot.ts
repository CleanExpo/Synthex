/**
 * NRPG → DR coverage snapshot aggregator — main API for SYN-843.
 *
 *   getNrpgCoverageSnapshot(opts?) → NrpgCoverageSnapshot
 *
 * Single round-trip aggregator for the admin dashboard. Pulls from:
 *   - lib/dashboard coverage repo (service_area_coverage)
 *   - lib/budget (monthly budget utilisation, per-contractor ledger)
 *   - lib/kpi (latest 30d/90d snapshots, retreat candidates)
 *
 * The output is a fully-formed snapshot the UI page renders without
 * additional fetches.
 *
 * Contractor PII never enters this module — only the pseudonymous
 * contractor IDs from the source rows.
 *
 * @see SYN-843 (parent: SYN-834 epic)
 * @see lib/dashboard/README.md
 */

import {
  getMonthlyBudgetUtilisation,
  getLedgerForContractor,
} from '@/lib/budget';
import { getLatestSnapshot, getRetreatCandidates } from '@/lib/kpi';
import { logger } from '@/lib/logger';
import { supabaseCoverageRepository } from './supabase-coverage-repository';
import type {
  ContractorCoverageSummary,
  CoverageStatus,
  DashboardLocationRow,
  NrpgCoverageSnapshot,
  ServiceAreaCoverage,
  SnapshotOptions,
} from './types';

const ALL_STATUSES: CoverageStatus[] = [
  'active',
  'paused',
  'retreated',
  'closed',
];

function emptyCounts(): Record<CoverageStatus | 'total', number> {
  return {
    active: 0,
    paused: 0,
    retreated: 0,
    closed: 0,
    total: 0,
  };
}

export async function getNrpgCoverageSnapshot(
  opts: SnapshotOptions = {}
): Promise<NrpgCoverageSnapshot> {
  const coverageRepo = opts.coverageRepo ?? supabaseCoverageRepository;
  const loadMonthlyBudget =
    opts.loadMonthlyBudget ?? getMonthlyBudgetUtilisation;
  const loadRetreatCandidates =
    opts.loadRetreatCandidates ?? getRetreatCandidates;
  const loadLedgerForContractor =
    opts.loadLedgerForContractor ?? getLedgerForContractor;
  const loadLatestKpi =
    opts.loadLatestKpi ??
    ((coverageId, period) => getLatestSnapshot(coverageId, period));

  // Run independent reads in parallel
  const [coverages, monthlyBudget, retreatCandidates] = await Promise.all([
    coverageRepo.findAllForDr(),
    loadMonthlyBudget(),
    loadRetreatCandidates(),
  ]);

  const retreatSet = new Set(
    retreatCandidates.map(c => c.serviceAreaCoverageId)
  );

  // Per-coverage KPI lookups — fan-out, but capped to 4 concurrent to
  // keep Supabase happy if there are hundreds of coverages.
  const locations = await mapWithConcurrency(coverages, 4, async coverage => {
    const [k30, k90] = await Promise.all([
      loadLatestKpi(coverage.id, 30),
      loadLatestKpi(coverage.id, 90),
    ]);
    const monthlyAud = await monthlyAudForCoverage(
      coverage,
      loadLedgerForContractor
    );
    const row: DashboardLocationRow = {
      serviceAreaCoverageId: coverage.id,
      suburb: coverage.suburb,
      postcode: coverage.postcode,
      status: coverage.status,
      openedByContractorId: coverage.openedByContractorId,
      openedAt: coverage.openedAt,
      monthlyAud,
      latestThirtyDayKpi: k30 ?? undefined,
      latestNinetyDayKpi: k90 ?? undefined,
      flaggedForRetreat: retreatSet.has(coverage.id),
    };
    return row;
  });

  // Per-contractor aggregates
  const contractors = aggregateByContractor(locations);

  // Counts
  const counts = emptyCounts();
  for (const r of locations) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    counts.total += 1;
  }
  for (const s of ALL_STATUSES) {
    counts[s] = counts[s] ?? 0;
  }

  const snapshot: NrpgCoverageSnapshot = {
    generatedAt: new Date().toISOString(),
    monthlyBudget,
    locations,
    contractors,
    retreatCandidates,
    counts,
  };

  logger.info('[dashboard.snapshot] assembled', {
    locationCount: locations.length,
    contractorCount: contractors.length,
    retreatCount: retreatCandidates.length,
    monthlyCommittedAud: monthlyBudget.totalCommittedAud,
  });

  return snapshot;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

async function monthlyAudForCoverage(
  coverage: ServiceAreaCoverage,
  loadLedgerForContractor: (id: string) => Promise<
    {
      serviceAreaCoverageId: string;
      monthlyAmountAud: number;
      status: 'active' | 'paused' | 'closed';
    }[]
  >
): Promise<number> {
  // Pull the ledger entries for this contractor and find the row
  // matching the coverage. Cheap because the contractor's ledger is
  // typically a few rows, not thousands.
  const entries = await loadLedgerForContractor(coverage.openedByContractorId);
  const match = entries.find(e => e.serviceAreaCoverageId === coverage.id);
  return match?.monthlyAmountAud ?? 0;
}

function aggregateByContractor(
  rows: DashboardLocationRow[]
): ContractorCoverageSummary[] {
  const map = new Map<string, ContractorCoverageSummary>();
  for (const r of rows) {
    const cur = map.get(r.openedByContractorId) ?? {
      contractorId: r.openedByContractorId,
      activeLocationCount: 0,
      pausedLocationCount: 0,
      monthlyAud: 0,
    };
    if (r.status === 'active') cur.activeLocationCount += 1;
    if (r.status === 'paused') cur.pausedLocationCount += 1;
    if (r.status === 'active' || r.status === 'paused') {
      cur.monthlyAud += r.monthlyAud;
    }
    map.set(r.openedByContractorId, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.activeLocationCount - a.activeLocationCount
  );
}

/**
 * Promise.all-style map but with bounded concurrency. Used to fan out
 * KPI lookups without flooding Supabase.
 */
async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
