/**
 * SEAM: takeRankSnapshot(orgId) — the exported service the rank-snapshot cron calls.
 * Catches: a moved keyword not becoming a rank outcome event, an unchanged one
 * becoming noise, a same-day replay double-counting, a missing location failing
 * the snapshot. Misses: the real writer's persistence (covered by
 * local-outcome-writer.test.ts and the J7 JEV family).
 */

const store = {
  snapshots: [] as Array<{
    keywordTargetId: string;
    position: number | null;
    snapshotDate: Date;
  }>,
  locations: [] as Array<{ id: string; isPrimary: boolean }>,
  analyticsPosition: 4.2 as number | null,
  recorded: new Map<string, Record<string, unknown>>(),
  calls: [] as Array<Record<string, unknown>>,
  writerFails: false,
};

jest.mock('@/lib/prisma', () => {
  const p = {
    gSCProperty: {
      findFirst: async () => ({ siteUrl: 'https://x.example/' }),
    },
    keywordTarget: {
      groupBy: async () => [{ organizationId: 'org-1' }],
      findMany: async () => [
        { id: 'kt-1', organizationId: 'org-1', keyword: 'emergency plumber' },
      ],
    },
    gBPLocation: {
      findFirst: async (args: { where: { isPrimary?: boolean } }) => {
        const pool = args.where.isPrimary
          ? store.locations.filter(l => l.isPrimary)
          : store.locations;
        return pool[0] ?? null;
      },
    },
    keywordRankSnapshot: {
      findFirst: async (args: { where: { snapshotDate: { lt: Date } } }) => {
        const prior = store.snapshots
          .filter(s => s.snapshotDate < args.where.snapshotDate.lt)
          .sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
        return prior[0] ?? null;
      },
      upsert: async (args: {
        create: {
          keywordTargetId: string;
          position: number | null;
          snapshotDate: Date;
        };
      }) => {
        const c = args.create;
        const hit = store.snapshots.find(
          s =>
            s.keywordTargetId === c.keywordTargetId &&
            s.snapshotDate.getTime() === c.snapshotDate.getTime()
        );
        if (hit) hit.position = c.position;
        else store.snapshots.push({ ...c });
      },
    },
  };
  return { __esModule: true, default: p, prisma: p };
});

jest.mock('@/lib/google/search-console', () => ({
  getSearchAnalytics: async () => ({
    rows:
      store.analyticsPosition === null
        ? []
        : [
            {
              keys: ['emergency plumber'],
              position: store.analyticsPosition,
              impressions: 300,
              clicks: 9,
              ctr: 0.03,
            },
          ],
  }),
}));

jest.mock('@/lib/marketing-agency/outcomes/local-outcome-writer', () => ({
  recordLocalOutcome: async (
    input: { dedupeKey: string } & Record<string, unknown>
  ) => {
    store.calls.push(input);
    if (store.writerFails) throw new Error('writer down');
    const dup = store.recorded.has(input.dedupeKey);
    if (!dup) store.recorded.set(input.dedupeKey, input);
    return { status: dup ? 'duplicate' : 'recorded' };
  },
}));

jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: async () => undefined,
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

import { takeRankSnapshot } from '@/lib/seo/rank-tracker';

const DAY = 86400000;
function yesterday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - DAY);
}

beforeEach(() => {
  store.snapshots = [
    { keywordTargetId: 'kt-1', position: 14, snapshotDate: yesterday() },
  ];
  store.locations = [{ id: 'loc-1', isPrimary: true }];
  store.analyticsPosition = 4.2;
  store.recorded = new Map();
  store.writerFails = false;
  store.calls = [];
});

describe('takeRankSnapshot rank outcomes', () => {
  it('records one rank outcome with the location when a keyword moves', async () => {
    await takeRankSnapshot('org-1');

    expect(store.recorded.size).toBe(1);
    expect(store.calls).toEqual([
      expect.objectContaining({
        organizationId: 'org-1',
        locationId: 'loc-1',
        kind: 'rank',
        observedValue: '4.2',
        metadata: expect.objectContaining({
          keyword: 'emergency plumber',
          previousPosition: 14,
          position: 4.2,
        }),
      }),
    ]);
  });

  it('records nothing when the position is unchanged', async () => {
    store.snapshots[0].position = 4.2;
    await takeRankSnapshot('org-1');
    expect(store.recorded.size).toBe(0);
  });

  it('records nothing new on a second run the same day', async () => {
    await takeRankSnapshot('org-1');
    await takeRankSnapshot('org-1');
    expect(store.recorded.size).toBe(1);
  });

  it('records nothing when the keyword has no position today', async () => {
    store.analyticsPosition = null;
    await takeRankSnapshot('org-1');
    expect(store.recorded.size).toBe(0);
  });

  it('falls back to any location when none is primary', async () => {
    store.locations = [{ id: 'loc-2', isPrimary: false }];
    await takeRankSnapshot('org-1');
    expect(store.calls).toEqual([
      expect.objectContaining({ locationId: 'loc-2' }),
    ]);
  });

  it('still snapshots, without an outcome, when the org has no location', async () => {
    store.locations = [];
    const result = await takeRankSnapshot('org-1');
    expect(result).toEqual({ snapshotCount: 1, outcomeFailures: 0 });
    expect(store.calls).toEqual([]);
  });

  it('keeps the snapshot but reports the failure when the writer throws', async () => {
    store.writerFails = true;
    const result = await takeRankSnapshot('org-1');
    expect(result).toEqual({ snapshotCount: 1, outcomeFailures: 1 });
  });
});

describe('GET /api/cron/rank-snapshot outcome failures', () => {
  const run = async () => {
    const { GET } = await import('@/app/api/cron/rank-snapshot/route');
    const res = await GET({} as never);
    return res.json();
  };

  it('reports success with zero outcome failures when the writer works', async () => {
    const body = await run();
    expect(body).toMatchObject({
      success: true,
      totalSnapshots: 1,
      errors: 0,
      outcomeFailures: 0,
    });
  });

  it('answers success:false and counts the error when the writer throws', async () => {
    store.writerFails = true;
    const body = await run();
    expect(body).toMatchObject({
      success: false,
      totalSnapshots: 1,
      errors: 1,
      outcomeFailures: 1,
    });
  });
});
