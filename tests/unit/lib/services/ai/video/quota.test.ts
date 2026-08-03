/**
 * Video quota — delegation to the append-only spend log (SYN-1115 round-6).
 *
 * ## What happened to the previous 15 tests
 *
 * They exercised the counter implementation: conditional `updateMany` with
 * `spent <= cap - amount`, lazy period rollover, and the rollover race retry.
 * That implementation is RETIRED — video now reserves and finalises against the
 * same event log the image path uses, so there is no counter left to test.
 *
 * Those tests were deliberately preserved untouched through rounds 1-5 as a
 * regression control. Deleting them now is not a loss of coverage: the property
 * they protected — concurrent reservations cannot jointly breach the cap — is
 * now proven in `tests/integration/media-spend-log.integration.test.ts` against
 * a REAL database, where a row lock can actually be observed, rather than
 * against a mocked Prisma client where it could only be asserted.
 *
 * What remains testable here is the delegation contract.
 */
const mockReserveSpend = jest.fn(async () => ({}));
const mockFinalizeSpend = jest.fn(async () => true);
const mockSpendSnapshot = jest.fn(async () => ({
  dailyUsd: 4,
  monthlyUsd: 20,
  mcpDailyUsd: 0,
  dailyCapUsd: 5,
  monthlyCapUsd: 25,
}));

jest.mock('@/lib/services/ai/image/spend-log', () => ({
  reserveSpend: (...a: unknown[]) => mockReserveSpend(...(a as [])),
  finalizeSpend: (...a: unknown[]) => mockFinalizeSpend(...(a as [])),
  spendSnapshot: (...a: unknown[]) => mockSpendSnapshot(...(a as [])),
}));

import {
  holdQuota,
  settleQuota,
  releaseQuota,
  quotaSnapshot,
} from '@/lib/services/ai/video/quota';

beforeEach(() => {
  jest.clearAllMocks();
  // resetMocks wipes implementations between tests — restore all three.
  mockReserveSpend.mockResolvedValue({});
  mockFinalizeSpend.mockResolvedValue(true);
  mockSpendSnapshot.mockResolvedValue({
    dailyUsd: 4,
    monthlyUsd: 20,
    mcpDailyUsd: 0,
    dailyCapUsd: 5,
    monthlyCapUsd: 25,
  });
});

describe('holdQuota reserves against the shared log', () => {
  it('passes the caller-supplied hold id through, so settlement can key on it', async () => {
    const returned = await holdQuota(
      'org-1',
      0.42,
      'studio',
      'hold-1',
      'run-1'
    );

    expect(returned).toBe('hold-1');
    expect(mockReserveSpend).toHaveBeenCalledWith({
      holdId: 'hold-1',
      organizationId: 'org-1',
      initiatedBy: 'studio',
      amountUsd: 0.42,
      // Recorded on the reserve event so the stale sweep can tell a video hold
      // (whose absence of an owner row PROVES nothing was submitted) from an
      // image hold (where absence proves nothing at all).
      mediaType: 'video',
      runId: 'run-1',
    });
  });

  it('propagates a refusal without swallowing it', async () => {
    const boom = new Error('QuotaExceeded');
    mockReserveSpend.mockRejectedValueOnce(boom);
    await expect(holdQuota('org-1', 0.42, 'studio', 'hold-1')).rejects.toThrow(
      boom
    );
  });
});

describe('settle and release share ONE terminal key', () => {
  it('settle finalises with the actual cost', async () => {
    await settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio');
    expect(mockFinalizeSpend).toHaveBeenCalledWith({
      holdId: 'hold-1',
      organizationId: 'org-1',
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });
  });

  it('release finalises the whole reservation', async () => {
    await releaseQuota('org-1', 'hold-1', 0.42, 'studio');
    expect(mockFinalizeSpend).toHaveBeenCalledWith({
      holdId: 'hold-1',
      organizationId: 'org-1',
      initiatedBy: 'studio',
      heldUsd: 0.42,
      kind: 'release',
    });
  });

  it('reports false when the hold was already finalised elsewhere', async () => {
    // The webhook replay / sweep race. Callers must not treat this as an error.
    mockFinalizeSpend.mockResolvedValueOnce(false);
    await expect(
      settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio')
    ).resolves.toBe(false);
  });

  it('both operations target the SAME hold, which is what makes them exclusive', async () => {
    await settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio');
    await releaseQuota('org-1', 'hold-1', 0.42, 'studio');
    const holdIds = mockFinalizeSpend.mock.calls.map(
      c => (c[0] as unknown as { holdId: string }).holdId
    );
    expect(holdIds).toEqual(['hold-1', 'hold-1']);
  });
});

describe('quotaSnapshot reads derived spend', () => {
  it('maps log windows onto the legacy snapshot shape', async () => {
    const snap = await quotaSnapshot('org-1');
    expect(snap).toMatchObject({
      spentUsd: 20,
      monthlyBudgetUsd: 25,
      spentTodayUsd: 4,
      dailyBudgetUsd: 5,
    });
  });

  it('warns at 80% of either cap', async () => {
    // 4/5 daily = 80%.
    await expect(quotaSnapshot('org-1')).resolves.toMatchObject({
      warning: true,
    });

    mockSpendSnapshot.mockResolvedValueOnce({
      dailyUsd: 1,
      monthlyUsd: 1,
      mcpDailyUsd: 0,
      dailyCapUsd: 5,
      monthlyCapUsd: 25,
    });
    await expect(quotaSnapshot('org-1')).resolves.toMatchObject({
      warning: false,
    });
  });
});
