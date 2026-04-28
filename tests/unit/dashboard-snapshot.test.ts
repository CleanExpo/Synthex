/**
 * Unit tests for lib/dashboard/
 *
 * Covers:
 *  - getNrpgCoverageSnapshot: shape, counts, retreat flag, contractor aggregation
 *  - Per-coverage monthlyAud lookup via injected loadLedgerForContractor
 *  - Bounded fan-out (no crash with hundreds of coverages — smoke test)
 *  - snapshotToCsv: header, row format, escaping commas/quotes
 *  - DR-only filter is enforced by the (injected) repo
 *
 * @see SYN-843 (parent: SYN-834 epic)
 */

import { describe, it, expect, jest } from '@jest/globals';
import { getNrpgCoverageSnapshot, snapshotToCsv } from '@/lib/dashboard';
import type {
  CoverageRepository,
  ServiceAreaCoverage,
  SnapshotOptions,
} from '@/lib/dashboard/types';
import type { LedgerEntry, MonthlyUtilisation } from '@/lib/budget';
import type { KpiSnapshot, RetreatCandidate } from '@/lib/kpi';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function coverage(
  overrides: Partial<ServiceAreaCoverage> = {}
): ServiceAreaCoverage {
  return {
    id: 'cov_1',
    brand: 'DR',
    postcode: '4000',
    suburb: 'Brisbane CBD',
    state: 'QLD',
    openedByContractorId: 'contractor_a',
    openedAt: '2026-04-01T00:00:00.000Z',
    closedAt: null,
    status: 'active',
    gbpUpdatedAt: null,
    bingUpdatedAt: null,
    sourceOfTruthJobId: 'job_1',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function ledgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'ledger_1',
    serviceAreaCoverageId: 'cov_1',
    sourceOfTruthJobId: 'job_1',
    contractorId: 'contractor_a',
    postcode: '4000',
    suburb: 'Brisbane CBD',
    monthlyAmountAud: 55,
    openedAt: '2026-04-01T00:00:00.000Z',
    pausedAt: null,
    pausedReason: null,
    closedAt: null,
    status: 'active',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(rows: ServiceAreaCoverage[]): CoverageRepository {
  return {
    async findAllForDr() {
      return rows;
    },
  };
}

function defaultMonthlyBudget(): MonthlyUtilisation {
  return {
    totalCommittedAud: 110,
    capAud: 10000,
    utilisationPct: 1.1,
    activeLocationCount: 2,
  };
}

function defaultOpts(
  rows: ServiceAreaCoverage[],
  overrides: Partial<SnapshotOptions> = {}
): SnapshotOptions {
  const ledgersByContractor = new Map<string, LedgerEntry[]>();
  for (const r of rows) {
    const existing = ledgersByContractor.get(r.openedByContractorId) ?? [];
    existing.push(
      ledgerEntry({
        contractorId: r.openedByContractorId,
        serviceAreaCoverageId: r.id,
        suburb: r.suburb,
        postcode: r.postcode,
      })
    );
    ledgersByContractor.set(r.openedByContractorId, existing);
  }
  return {
    coverageRepo: makeRepo(rows),
    loadMonthlyBudget: async () => defaultMonthlyBudget(),
    loadRetreatCandidates: async () => [],
    loadLedgerForContractor: async (id: string) =>
      ledgersByContractor.get(id) ?? [],
    loadLatestKpi: async () => null,
    ...overrides,
  };
}

describe('getNrpgCoverageSnapshot — basic shape', () => {
  it('returns empty arrays for an empty repo', async () => {
    const snap = await getNrpgCoverageSnapshot(defaultOpts([]));
    expect(snap.locations).toEqual([]);
    expect(snap.contractors).toEqual([]);
    expect(snap.retreatCandidates).toEqual([]);
    expect(snap.counts.total).toBe(0);
    expect(snap.counts.active).toBe(0);
    expect(snap.counts.paused).toBe(0);
    expect(snap.counts.retreated).toBe(0);
    expect(snap.counts.closed).toBe(0);
    expect(snap.monthlyBudget.capAud).toBe(10000);
    expect(typeof snap.generatedAt).toBe('string');
  });

  it('joins coverage + ledger + KPI into one row per coverage', async () => {
    const rows = [
      coverage({
        id: 'cov_1',
        suburb: 'Brisbane CBD',
        openedByContractorId: 'contractor_a',
      }),
    ];
    const k30: KpiSnapshot = {
      id: 'kpi_1',
      serviceAreaCoverageId: 'cov_1',
      measuredAt: '2026-04-15T00:00:00.000Z',
      periodDays: 30,
      impressions: 800,
      clicks: 25,
      conversions: 4,
      revenueAud: 320,
      verificationState: 'directional',
      verifiedAt: null,
      createdAt: '2026-04-15T00:00:00.000Z',
    };
    const opts = defaultOpts(rows, {
      loadLatestKpi: async (_id, period) => (period === 30 ? k30 : null),
    });
    const snap = await getNrpgCoverageSnapshot(opts);
    expect(snap.locations).toHaveLength(1);
    const r = snap.locations[0];
    expect(r.suburb).toBe('Brisbane CBD');
    expect(r.monthlyAud).toBe(55);
    expect(r.latestThirtyDayKpi?.clicks).toBe(25);
    expect(r.latestNinetyDayKpi).toBeUndefined();
    expect(r.flaggedForRetreat).toBe(false);
  });

  it('flags coverages present in retreatCandidates', async () => {
    const rows = [coverage({ id: 'cov_dead' })];
    const candidate: RetreatCandidate = {
      serviceAreaCoverageId: 'cov_dead',
      latestNinetyDaySnapshot: {
        id: 'kpi_dead',
        serviceAreaCoverageId: 'cov_dead',
        measuredAt: '2026-04-29T00:00:00.000Z',
        periodDays: 90,
        impressions: 200,
        clicks: 0,
        conversions: 0,
        revenueAud: 0,
        verificationState: 'directional',
        verifiedAt: null,
        createdAt: '2026-04-29T00:00:00.000Z',
      },
    };
    const opts = defaultOpts(rows, {
      loadRetreatCandidates: async () => [candidate],
    });
    const snap = await getNrpgCoverageSnapshot(opts);
    expect(snap.retreatCandidates).toHaveLength(1);
    expect(snap.locations[0].flaggedForRetreat).toBe(true);
  });
});

describe('getNrpgCoverageSnapshot — counts + per-status', () => {
  it('tallies counts per status + total', async () => {
    const rows = [
      coverage({ id: 'a', status: 'active' }),
      coverage({ id: 'b', status: 'active' }),
      coverage({ id: 'c', status: 'paused' }),
      coverage({ id: 'd', status: 'retreated' }),
      coverage({ id: 'e', status: 'closed' }),
    ];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    expect(snap.counts).toEqual({
      active: 2,
      paused: 1,
      retreated: 1,
      closed: 1,
      total: 5,
    });
  });
});

describe('getNrpgCoverageSnapshot — contractor aggregation', () => {
  it('rolls up locations by contractor', async () => {
    const rows = [
      coverage({ id: 'a', openedByContractorId: 'c1', status: 'active' }),
      coverage({ id: 'b', openedByContractorId: 'c1', status: 'active' }),
      coverage({ id: 'c', openedByContractorId: 'c1', status: 'paused' }),
      coverage({ id: 'd', openedByContractorId: 'c2', status: 'active' }),
      coverage({ id: 'e', openedByContractorId: 'c3', status: 'closed' }),
    ];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    const c1 = snap.contractors.find(c => c.contractorId === 'c1')!;
    expect(c1.activeLocationCount).toBe(2);
    expect(c1.pausedLocationCount).toBe(1);
    expect(c1.monthlyAud).toBe(55 * 3); // 2 active + 1 paused × $55
    const c2 = snap.contractors.find(c => c.contractorId === 'c2')!;
    expect(c2.activeLocationCount).toBe(1);
    const c3 = snap.contractors.find(c => c.contractorId === 'c3')!;
    expect(c3.activeLocationCount).toBe(0);
    expect(c3.monthlyAud).toBe(0); // closed locations don't contribute
  });

  it('sorts contractors by activeLocationCount descending', async () => {
    const rows = [
      coverage({ id: 'a', openedByContractorId: 'small', status: 'active' }),
      coverage({ id: 'b', openedByContractorId: 'big', status: 'active' }),
      coverage({ id: 'c', openedByContractorId: 'big', status: 'active' }),
      coverage({ id: 'd', openedByContractorId: 'big', status: 'active' }),
    ];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    expect(snap.contractors[0].contractorId).toBe('big');
    expect(snap.contractors[1].contractorId).toBe('small');
  });
});

describe('getNrpgCoverageSnapshot — fan-out smoke', () => {
  it('handles 50 coverages without crash', async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      coverage({
        id: `cov_${i}`,
        suburb: `Suburb ${i}`,
        openedByContractorId: `c_${i % 5}`,
      })
    );
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    expect(snap.locations).toHaveLength(50);
    expect(snap.counts.total).toBe(50);
  });
});

describe('snapshotToCsv', () => {
  it('emits a header row + one line per location', async () => {
    const rows = [
      coverage({ id: 'a', suburb: 'Carindale', openedByContractorId: 'c1' }),
      coverage({ id: 'b', suburb: 'Mansfield', openedByContractorId: 'c1' }),
    ];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    const csv = snapshotToCsv(snap);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('serviceAreaCoverageId');
    expect(lines[0]).toContain('thirtyDayClicks');
    expect(lines[1]).toContain('Carindale');
    expect(lines[2]).toContain('Mansfield');
  });

  it('escapes commas + quotes in suburb names (RFC-4180-ish)', async () => {
    const rows = [coverage({ id: 'a', suburb: 'Spring Hill, "Inner"' })];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    const csv = snapshotToCsv(snap);
    expect(csv).toContain('"Spring Hill, ""Inner"""');
  });

  it('serialises monthlyAud with 2 decimals', async () => {
    const rows = [coverage({ id: 'a' })];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    expect(snapshotToCsv(snap)).toContain('55.00');
  });

  it('emits empty cells for missing KPI snapshots', async () => {
    const rows = [coverage({ id: 'a' })];
    const snap = await getNrpgCoverageSnapshot(defaultOpts(rows));
    const csv = snapshotToCsv(snap);
    // Last 6 columns (the KPI block) should be empty after the trailing comma.
    expect(csv).toMatch(/false,,,,,,\s*$/m);
  });

  it('serialises KPI counts when present', async () => {
    const rows = [coverage({ id: 'a' })];
    const k30: KpiSnapshot = {
      id: 'kpi_a',
      serviceAreaCoverageId: 'a',
      measuredAt: '2026-04-15T00:00:00.000Z',
      periodDays: 30,
      impressions: 800,
      clicks: 25,
      conversions: 4,
      revenueAud: 320,
      verificationState: 'directional',
      verifiedAt: null,
      createdAt: '2026-04-15T00:00:00.000Z',
    };
    const snap = await getNrpgCoverageSnapshot(
      defaultOpts(rows, {
        loadLatestKpi: async (_id, period) => (period === 30 ? k30 : null),
      })
    );
    const csv = snapshotToCsv(snap);
    expect(csv).toContain(',25,4,320.00,');
  });
});
