const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organizationVideoQuota: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      upsert: (...a: unknown[]) => mockUpsert(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        organizationVideoQuota: {
          findUnique: (...a: unknown[]) => mockFindUnique(...a),
          upsert: (...a: unknown[]) => mockUpsert(...a),
          update: (...a: unknown[]) => mockUpdate(...a),
        },
      }),
  },
}));

import {
  holdQuota,
  settleQuota,
  releaseQuota,
} from '@/lib/services/ai/video/quota';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const baseQuota = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'q1',
  organizationId: 'org1',
  monthlyBudgetUsd: 25,
  dailyBudgetUsd: 5,
  spentUsd: 0,
  spentTodayUsd: 0,
  spentTodayMcpUsd: 0,
  periodStart: new Date(),
  dayStart: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockImplementation(async ({ create }: { create: object }) =>
    baseQuota(create as object)
  );
  mockUpdate.mockResolvedValue(baseQuota());
});

describe('quota service', () => {
  it('holds the estimate when under both caps', async () => {
    mockUpsert.mockResolvedValue(baseQuota({ spentUsd: 1, spentTodayUsd: 1 }));
    await expect(holdQuota('org1', 0.3, 'studio')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: 0.3 },
          spentTodayUsd: { increment: 0.3 },
        }),
      })
    );
  });

  it('rejects with the MONTHLY cap named when monthly would be exceeded', async () => {
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 24.9, spentTodayUsd: 0 })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toThrow(
      QuotaExceededError
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toMatchObject({
      cap: 'monthly',
    });
  });

  it('rejects with the DAILY cap named when daily would be exceeded', async () => {
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 1, spentTodayUsd: 4.9 })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).rejects.toMatchObject({
      cap: 'daily',
    });
  });

  it('caps MCP-initiated spend at 50% of daily budget', async () => {
    mockUpsert.mockResolvedValue(baseQuota({ spentTodayMcpUsd: 2.4 }));
    await expect(holdQuota('org1', 0.2, 'mcp')).rejects.toMatchObject({
      cap: 'mcp-daily',
    });
  });

  it('resets the monthly counter when periodStart is a previous month', async () => {
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    mockUpsert.mockResolvedValue(
      baseQuota({ spentUsd: 24.9, periodStart: lastMonth })
    );
    await expect(holdQuota('org1', 0.3, 'studio')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: 0.3,
          periodStart: expect.any(Date),
        }),
      })
    );
  });

  it('resets the daily counters when dayStart is a previous day', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    mockUpsert.mockResolvedValue(
      baseQuota({
        spentTodayUsd: 4.9,
        spentTodayMcpUsd: 2.4,
        dayStart: yesterday,
      })
    );
    await expect(holdQuota('org1', 0.3, 'mcp')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentTodayUsd: 0.3,
          dayStart: expect.any(Date),
        }),
      })
    );
  });

  it('settle adjusts the hold to actual cost', async () => {
    await settleQuota('org1', 0.3, 0.27, 'studio');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: expect.closeTo(-0.03, 5) },
          spentTodayUsd: { increment: expect.closeTo(-0.03, 5) },
        }),
      })
    );
  });

  it('release subtracts the full hold', async () => {
    await releaseQuota('org1', 0.3, 'mcp');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spentUsd: { increment: -0.3 },
          spentTodayUsd: { increment: -0.3 },
          spentTodayMcpUsd: { increment: -0.3 },
        }),
      })
    );
  });
});
