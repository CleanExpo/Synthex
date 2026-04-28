/**
 * Unit tests for lib/kpi/
 *
 * Covers:
 *  - Validation: required fields + period whitelist + non-negative numerics
 *  - Verified-state promotion: only 30-day windows ≥ threshold
 *  - Threshold override (opts + env precedence)
 *  - getLatestSnapshot: with and without periodDays filter
 *  - getCoverageKpiHistory: returns all snapshots
 *  - getRetreatCandidates: filters to 90-day zero-attribution coverages
 *
 * @see SYN-842 (parent: SYN-834 epic)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  VERIFY_CONVERSIONS_THRESHOLD_DEFAULT,
  recordKpiSnapshot,
  getLatestSnapshot,
  getCoverageKpiHistory,
  getRetreatCandidates,
} from '@/lib/kpi';
import type {
  KpiPeriodDays,
  KpiRepository,
  KpiSnapshot,
  KpiVerificationState,
  RecordKpiInput,
} from '@/lib/kpi/types';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeMockRepo(): KpiRepository & { _rows: KpiSnapshot[] } {
  const rows: KpiSnapshot[] = [];
  let nextId = 1;
  return {
    _rows: rows,
    async insert(
      input: RecordKpiInput & {
        verificationState: KpiVerificationState;
        verifiedAt: string | null;
      }
    ) {
      const snapshot: KpiSnapshot = {
        id: `kpi_${nextId++}`,
        serviceAreaCoverageId: input.serviceAreaCoverageId,
        measuredAt: new Date().toISOString(),
        periodDays: input.periodDays,
        impressions: input.impressions ?? 0,
        clicks: input.clicks ?? 0,
        conversions: input.conversions ?? 0,
        revenueAud: input.revenueAud ?? 0,
        verificationState: input.verificationState,
        verifiedAt: input.verifiedAt,
        createdAt: new Date().toISOString(),
      };
      rows.push(snapshot);
      return snapshot;
    },
    async findLatestForCoverage(
      coverageId: string,
      periodDays?: KpiPeriodDays
    ) {
      const filtered = rows
        .filter(r => r.serviceAreaCoverageId === coverageId)
        .filter(r =>
          periodDays === undefined ? true : r.periodDays === periodDays
        )
        .sort(
          (a, b) =>
            new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
        );
      return filtered[0] ?? null;
    },
    async findAllForCoverage(coverageId: string) {
      return rows
        .filter(r => r.serviceAreaCoverageId === coverageId)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
        );
    },
    async listLatestNinetyDayPerCoverage() {
      const seen = new Set<string>();
      const latest: KpiSnapshot[] = [];
      const sorted = rows
        .filter(r => r.periodDays === 90)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
        );
      for (const r of sorted) {
        if (seen.has(r.serviceAreaCoverageId)) continue;
        seen.add(r.serviceAreaCoverageId);
        latest.push(r);
      }
      return latest;
    },
  };
}

describe('lib/kpi — recordKpiSnapshot validation', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  beforeEach(() => {
    repo = makeMockRepo();
  });

  it('throws when serviceAreaCoverageId is missing', async () => {
    await expect(
      recordKpiSnapshot(
        // @ts-expect-error — deliberately invalid
        { periodDays: 30 },
        { repository: repo }
      )
    ).rejects.toThrow(/serviceAreaCoverageId required/);
  });

  it('throws when periodDays is not 7/30/90', async () => {
    await expect(
      recordKpiSnapshot(
        {
          serviceAreaCoverageId: 'cov_1',
          // @ts-expect-error — deliberately invalid
          periodDays: 14,
        },
        { repository: repo }
      )
    ).rejects.toThrow(/periodDays must be 7, 30, or 90/);
  });

  it('throws on negative metric value', async () => {
    await expect(
      recordKpiSnapshot(
        {
          serviceAreaCoverageId: 'cov_1',
          periodDays: 7,
          clicks: -5,
        },
        { repository: repo }
      )
    ).rejects.toThrow(/clicks must be a non-negative finite number/);
  });

  it('throws on NaN metric value', async () => {
    await expect(
      recordKpiSnapshot(
        {
          serviceAreaCoverageId: 'cov_1',
          periodDays: 7,
          revenueAud: Number.NaN,
        },
        { repository: repo }
      )
    ).rejects.toThrow(/revenueAud must be a non-negative finite number/);
  });

  it('accepts a minimal valid input (zeros default)', async () => {
    const result = await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 7 },
      { repository: repo }
    );
    expect(result.snapshot.impressions).toBe(0);
    expect(result.snapshot.clicks).toBe(0);
    expect(result.snapshot.conversions).toBe(0);
    expect(result.snapshot.revenueAud).toBe(0);
    expect(result.snapshot.verificationState).toBe('directional');
    expect(result.promotedToVerified).toBe(false);
  });
});

describe('lib/kpi — verified-state promotion', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  beforeEach(() => {
    repo = makeMockRepo();
  });

  it('does NOT promote 7-day snapshots even at threshold', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 7,
        conversions: VERIFY_CONVERSIONS_THRESHOLD_DEFAULT,
      },
      { repository: repo }
    );
    expect(result.promotedToVerified).toBe(false);
    expect(result.snapshot.verificationState).toBe('directional');
    expect(result.snapshot.verifiedAt).toBeNull();
  });

  it('does NOT promote 90-day snapshots even at threshold', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 90,
        conversions: 999,
      },
      { repository: repo }
    );
    expect(result.promotedToVerified).toBe(false);
    expect(result.snapshot.verificationState).toBe('directional');
  });

  it('does NOT promote 30-day snapshots BELOW threshold', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 30,
        conversions: VERIFY_CONVERSIONS_THRESHOLD_DEFAULT - 1,
      },
      { repository: repo }
    );
    expect(result.promotedToVerified).toBe(false);
    expect(result.snapshot.verificationState).toBe('directional');
  });

  it('PROMOTES 30-day snapshots AT threshold', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 30,
        conversions: VERIFY_CONVERSIONS_THRESHOLD_DEFAULT,
      },
      { repository: repo }
    );
    expect(result.promotedToVerified).toBe(true);
    expect(result.snapshot.verificationState).toBe('verified');
    expect(result.snapshot.verifiedAt).not.toBeNull();
  });

  it('PROMOTES 30-day snapshots ABOVE threshold', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 30,
        conversions: 100,
      },
      { repository: repo }
    );
    expect(result.promotedToVerified).toBe(true);
  });

  it('honours opts.verifyConversionsThreshold override', async () => {
    const result = await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 30,
        conversions: 5,
      },
      { repository: repo, verifyConversionsThreshold: 5 }
    );
    expect(result.promotedToVerified).toBe(true);
  });

  it('honours env override when no opts override given', async () => {
    process.env.NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD = '10';
    try {
      const result = await recordKpiSnapshot(
        {
          serviceAreaCoverageId: 'cov_1',
          periodDays: 30,
          conversions: 10,
        },
        { repository: repo }
      );
      expect(result.promotedToVerified).toBe(true);
    } finally {
      delete process.env.NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD;
    }
  });

  it('opts override beats env override', async () => {
    process.env.NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD = '999';
    try {
      const result = await recordKpiSnapshot(
        {
          serviceAreaCoverageId: 'cov_1',
          periodDays: 30,
          conversions: 5,
        },
        { repository: repo, verifyConversionsThreshold: 5 }
      );
      expect(result.promotedToVerified).toBe(true);
    } finally {
      delete process.env.NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD;
    }
  });
});

describe('lib/kpi — read APIs', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  beforeEach(() => {
    repo = makeMockRepo();
  });

  it('getLatestSnapshot returns null when no rows exist', async () => {
    const result = await getLatestSnapshot('cov_missing', undefined, {
      repository: repo,
    });
    expect(result).toBeNull();
  });

  it('getLatestSnapshot returns most recent across all periods by default', async () => {
    // Insert 7d first, then 30d
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 7, clicks: 1 },
      { repository: repo }
    );
    await new Promise(r => setTimeout(r, 5));
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 30, clicks: 2 },
      { repository: repo }
    );
    const latest = await getLatestSnapshot('cov_1', undefined, {
      repository: repo,
    });
    expect(latest?.periodDays).toBe(30);
    expect(latest?.clicks).toBe(2);
  });

  it('getLatestSnapshot filters by periodDays when given', async () => {
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 7, clicks: 1 },
      { repository: repo }
    );
    await new Promise(r => setTimeout(r, 5));
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 30, clicks: 2 },
      { repository: repo }
    );
    const latest = await getLatestSnapshot('cov_1', 7, { repository: repo });
    expect(latest?.periodDays).toBe(7);
    expect(latest?.clicks).toBe(1);
  });

  it('getLatestSnapshot rejects invalid periodDays', async () => {
    await expect(
      // @ts-expect-error — deliberately invalid
      getLatestSnapshot('cov_1', 14, { repository: repo })
    ).rejects.toThrow(/periodDays must be 7, 30, or 90/);
  });

  it('getLatestSnapshot rejects empty coverage id', async () => {
    await expect(
      getLatestSnapshot('', undefined, { repository: repo })
    ).rejects.toThrow(/serviceAreaCoverageId required/);
  });

  it('getCoverageKpiHistory returns all snapshots newest first', async () => {
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 7, clicks: 1 },
      { repository: repo }
    );
    await new Promise(r => setTimeout(r, 5));
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 30, clicks: 2 },
      { repository: repo }
    );
    await new Promise(r => setTimeout(r, 5));
    await recordKpiSnapshot(
      { serviceAreaCoverageId: 'cov_1', periodDays: 90, clicks: 3 },
      { repository: repo }
    );
    const history = await getCoverageKpiHistory('cov_1', { repository: repo });
    expect(history).toHaveLength(3);
    expect(history[0].clicks).toBe(3);
    expect(history[2].clicks).toBe(1);
  });

  it('getCoverageKpiHistory returns empty for unknown coverage', async () => {
    const history = await getCoverageKpiHistory('cov_unknown', {
      repository: repo,
    });
    expect(history).toEqual([]);
  });

  it('getCoverageKpiHistory rejects empty coverage id', async () => {
    await expect(
      getCoverageKpiHistory('', { repository: repo })
    ).rejects.toThrow(/serviceAreaCoverageId required/);
  });
});

describe('lib/kpi — getRetreatCandidates', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  beforeEach(() => {
    repo = makeMockRepo();
  });

  it('returns empty when no 90-day snapshots exist', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_1',
        periodDays: 30,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toEqual([]);
  });

  it('flags 90-day coverage with zero clicks AND zero conversions', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_dead',
        periodDays: 90,
        impressions: 500,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].serviceAreaCoverageId).toBe('cov_dead');
    expect(candidates[0].latestNinetyDaySnapshot.clicks).toBe(0);
  });

  it('does NOT flag coverage with clicks but zero conversions', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_clicky',
        periodDays: 90,
        impressions: 500,
        clicks: 12,
        conversions: 0,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toEqual([]);
  });

  it('does NOT flag coverage with conversions', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_winner',
        periodDays: 90,
        clicks: 100,
        conversions: 8,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toEqual([]);
  });

  it('uses ONLY the latest 90-day snapshot per coverage', async () => {
    // Older snapshot: zero (would flag)
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_recovered',
        periodDays: 90,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    await new Promise(r => setTimeout(r, 5));
    // Newer snapshot: has clicks (recovered)
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_recovered',
        periodDays: 90,
        clicks: 5,
        conversions: 1,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toEqual([]);
  });

  it('returns multiple candidates across different coverages', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_a',
        periodDays: 90,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_b',
        periodDays: 90,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_c',
        periodDays: 90,
        clicks: 50,
        conversions: 5,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toHaveLength(2);
    const ids = candidates.map(c => c.serviceAreaCoverageId).sort();
    expect(ids).toEqual(['cov_a', 'cov_b']);
  });

  it('ignores 30-day and 7-day zero-attribution snapshots', async () => {
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_x',
        periodDays: 7,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    await recordKpiSnapshot(
      {
        serviceAreaCoverageId: 'cov_y',
        periodDays: 30,
        clicks: 0,
        conversions: 0,
      },
      { repository: repo }
    );
    const candidates = await getRetreatCandidates({ repository: repo });
    expect(candidates).toEqual([]);
  });
});
