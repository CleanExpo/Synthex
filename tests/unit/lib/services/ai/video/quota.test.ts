/**
 * WS2 / SYN-1075 — quota TOCTOU tightening.
 *
 * holdQuota() previously read spent-so-far, checked caps in JS, then wrote —
 * a classic check-then-act race where two concurrent holds could both pass
 * the check before either write lands, overrunning the cap. It is now a
 * single conditional `updateMany` (`spentUsd <= cap - amount`) so the DB row
 * lock serialises concurrent holds and the second one atomically sees the
 * first's committed spend.
 *
 * These tests exercise holdQuota() against a fully mocked prisma client —
 * no real Postgres — asserting the conditional predicate/shape of the call
 * and that a `count: 0` result (the DB's way of saying "predicate failed")
 * is turned into a QuotaExceededError rather than silently succeeding.
 */
/** @jest-environment node */

const mockPrisma = {
  organizationVideoQuota: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { holdQuota } from '@/lib/services/ai/video/quota';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const ORG_ID = 'org-canary-1';

function quotaRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: 'q1',
    organizationId: ORG_ID,
    monthlyBudgetUsd: 25,
    dailyBudgetUsd: 5,
    spentUsd: 0,
    spentTodayUsd: 0,
    spentTodayMcpUsd: 0,
    periodStart: now,
    dayStart: now,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('holdQuota — same-period conditional update (TOCTOU close)', () => {
  it('issues a single conditional updateMany with spent <= cap - amount, and succeeds when count is 1', async () => {
    mockPrisma.organizationVideoQuota.upsert.mockResolvedValue(
      quotaRow({ spentUsd: 2, spentTodayUsd: 1 })
    );
    mockPrisma.organizationVideoQuota.updateMany.mockResolvedValue({
      count: 1,
    });

    await holdQuota(ORG_ID, 0.5, 'studio');

    expect(mockPrisma.organizationVideoQuota.updateMany).toHaveBeenCalledTimes(
      1
    );
    const call = mockPrisma.organizationVideoQuota.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      organizationId: ORG_ID,
      spentUsd: { lte: 25 - 0.5 },
      spentTodayUsd: { lte: 5 - 0.5 },
    });
    expect(call.data).toMatchObject({
      spentUsd: { increment: 0.5 },
      spentTodayUsd: { increment: 0.5 },
    });
    // Not an mcp hold — no spentTodayMcpUsd predicate.
    expect(call.where.spentTodayMcpUsd).toBeUndefined();
  });

  it('adds the mcp sub-cap predicate when initiatedBy is mcp', async () => {
    mockPrisma.organizationVideoQuota.upsert.mockResolvedValue(quotaRow());
    mockPrisma.organizationVideoQuota.updateMany.mockResolvedValue({
      count: 1,
    });

    await holdQuota(ORG_ID, 1, 'mcp');

    const call = mockPrisma.organizationVideoQuota.updateMany.mock.calls[0][0];
    expect(call.where.spentTodayMcpUsd).toEqual({ lte: 2.5 - 1 }); // 5 * 0.5 default fraction
    expect(call.data.spentTodayMcpUsd).toEqual({ increment: 1 });
  });

  it('rejects — throws QuotaExceededError — when the conditional update matches 0 rows (a concurrent hold already exceeded the cap)', async () => {
    mockPrisma.organizationVideoQuota.upsert.mockResolvedValue(
      quotaRow({ spentUsd: 24.8 })
    );
    // The DB predicate failed: a concurrent hold already pushed spend past
    // the cap between our read and our conditional write.
    mockPrisma.organizationVideoQuota.updateMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.organizationVideoQuota.findUnique.mockResolvedValue(
      quotaRow({ spentUsd: 24.9 })
    );

    await expect(holdQuota(ORG_ID, 0.5, 'studio')).rejects.toThrow(
      QuotaExceededError
    );
  });

  it('never allows a hold to "succeed" purely from the JS-side read — only a count >= 1 result commits', async () => {
    // Even though the read-time snapshot looks fine, the conditional
    // updateMany is the sole source of truth; if it reports 0 rows matched
    // the hold must fail closed.
    mockPrisma.organizationVideoQuota.upsert.mockResolvedValue(
      quotaRow({ spentUsd: 0, spentTodayUsd: 0 })
    );
    mockPrisma.organizationVideoQuota.updateMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.organizationVideoQuota.findUnique.mockResolvedValue(
      quotaRow({ spentTodayUsd: 4.9 })
    );

    await expect(holdQuota(ORG_ID, 0.5, 'studio')).rejects.toThrow(
      QuotaExceededError
    );
  });
});

describe('holdQuota — period rollover path', () => {
  it('resets to the estimate and guards the reset with the previous periodStart/dayStart', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    mockPrisma.organizationVideoQuota.upsert.mockResolvedValue(
      quotaRow({
        periodStart: staleDate,
        dayStart: staleDate,
        spentUsd: 20,
        spentTodayUsd: 4,
      })
    );
    mockPrisma.organizationVideoQuota.updateMany.mockResolvedValue({
      count: 1,
    });

    await holdQuota(ORG_ID, 1, 'studio');

    const call = mockPrisma.organizationVideoQuota.updateMany.mock.calls[0][0];
    expect(call.where.periodStart).toEqual(staleDate);
    expect(call.where.dayStart).toEqual(staleDate);
    expect(call.data.spentUsd).toBe(1); // reset, not increment
    expect(call.data.spentTodayUsd).toBe(1);
  });

  it('retries once (fresh conditional path) when it loses the rollover race', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    mockPrisma.organizationVideoQuota.upsert
      .mockResolvedValueOnce(
        quotaRow({
          periodStart: staleDate,
          dayStart: staleDate,
          spentUsd: 0,
          spentTodayUsd: 0,
        })
      )
      .mockResolvedValueOnce(quotaRow({ spentUsd: 1, spentTodayUsd: 1 }));
    mockPrisma.organizationVideoQuota.updateMany
      .mockResolvedValueOnce({ count: 0 }) // lost the rollover race
      .mockResolvedValueOnce({ count: 1 }); // fresh-period conditional path succeeds

    await holdQuota(ORG_ID, 0.25, 'studio');

    expect(mockPrisma.organizationVideoQuota.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.organizationVideoQuota.updateMany).toHaveBeenCalledTimes(
      2
    );
  });
});
