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
  reserveKey: (holdId: string) => `hold:${holdId}:reserve`,
  finalizeKey: (holdId: string) => `hold:${holdId}:final`,
}));

// The spend log's events, keyed as the real log keys them, and the ledger.
const mockEvents = new Map<string, Record<string, unknown>>();
const mockLedgerFindFirst = jest.fn();
const mockLedgerCreate = jest.fn();
const mockQueryRaw = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mediaSpendEvent: {
      findUnique: async ({ where }: { where: { eventKey: string } }) =>
        mockEvents.get(where.eventKey) ?? null,
    },
    pipelineCostLedger: {
      findFirst: (...a: unknown[]) => mockLedgerFindFirst(...a),
      create: (...a: unknown[]) => mockLedgerCreate(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as quota from '@/lib/services/ai/video/quota';
import {
  holdQuota,
  settleQuota,
  releaseQuota,
  quotaSnapshot,
} from '@/lib/services/ai/video/quota';

beforeEach(() => {
  jest.clearAllMocks();
  mockEvents.clear();
  mockLedgerFindFirst.mockResolvedValue(null);
  mockLedgerCreate.mockResolvedValue({ id: 'ledger-1' });
  mockQueryRaw.mockResolvedValue([]);
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

/**
 * One charged hold in the spend log: reserved at `heldUsd`, finalised by
 * `kind` at `actualUsd` (finalizeSpend stores actual - held).
 */
function chargedHold(
  holdId: string,
  heldUsd: number,
  actualUsd: number,
  kind: 'settle' | 'sweep' | 'release' = 'settle',
  mediaType: string | null = 'video'
) {
  const finalisedAt = new Date('2026-10-19T03:00:00.000Z');
  mockEvents.set(`hold:${holdId}:reserve`, {
    deltaUsd: heldUsd,
    organizationId: 'org-1',
    mediaType,
  });
  mockEvents.set(`hold:${holdId}:final`, {
    kind,
    deltaUsd: kind === 'release' ? -heldUsd : actualUsd - heldUsd,
    createdAt: finalisedAt,
  });
  return finalisedAt;
}

describe('the video ledger row survives a failed write', () => {
  it('a settle whose ledger write failed is backfilled when the settle is replayed', async () => {
    chargedHold('hold-1', 0.42, 0.105);
    mockLedgerCreate.mockRejectedValueOnce(new Error('ledger down'));

    // First delivery: the spend is settled, the audit row is not.
    await expect(
      settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio')
    ).resolves.toBe(true);

    // Replay: finalize no-ops, but the missing row must still be written.
    mockFinalizeSpend.mockResolvedValueOnce(false);
    await settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio');

    expect(mockLedgerCreate).toHaveBeenCalledTimes(2);
    expect(mockLedgerCreate.mock.calls[1][0].data).toMatchObject({
      pipelineName: 'video-generation',
      runId: 'hold-1',
      clientId: 'org-1',
      costUsd: 0.105,
    });
  });

  it('control: a replay whose row already exists writes no second row', async () => {
    chargedHold('hold-1', 0.42, 0.105);
    mockLedgerFindFirst.mockResolvedValue({ id: 'ledger-1' });
    mockFinalizeSpend.mockResolvedValueOnce(false);

    await settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio');

    expect(mockLedgerCreate).not.toHaveBeenCalled();
  });

  it('records what the spend LOG charged, at the time it was finalised', async () => {
    // A replay carrying a different actual must not contradict the log.
    const finalisedAt = chargedHold('hold-1', 0.42, 0.21);
    mockFinalizeSpend.mockResolvedValueOnce(false);

    await settleQuota('org-1', 'hold-1', 0.42, 0.105, 'studio');

    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    expect(mockLedgerCreate.mock.calls[0][0].data).toMatchObject({
      costUsd: 0.21,
      createdAt: finalisedAt,
    });
  });

  it('the sweep backfills every charged hold the query finds without a row', async () => {
    chargedHold('hold-1', 0.42, 0.105);
    chargedHold('hold-2', 0.3, 0.3, 'sweep');
    mockQueryRaw.mockResolvedValue([
      { hold_id: 'hold-1' },
      { hold_id: 'hold-2' },
    ]);

    await expect(
      quota.backfillMediaSpendLedger(new Date('2026-10-18T00:00:00.000Z'))
    ).resolves.toBe(2);
    expect(
      mockLedgerCreate.mock.calls.map(c => [c[0].data.runId, c[0].data.costUsd])
    ).toEqual([
      ['hold-1', 0.105],
      ['hold-2', 0.3],
    ]);
  });

  it('a backfill write that fails is left for the next pass, not fatal to the others', async () => {
    chargedHold('hold-1', 0.42, 0.105);
    chargedHold('hold-2', 0.3, 0.3, 'sweep');
    mockQueryRaw.mockResolvedValue([
      { hold_id: 'hold-1' },
      { hold_id: 'hold-2' },
    ]);
    mockLedgerCreate.mockRejectedValueOnce(new Error('ledger down'));

    await expect(
      quota.backfillMediaSpendLedger(new Date('2026-10-18T00:00:00.000Z'))
    ).resolves.toBe(1);
  });

  it.each([
    ['a release', () => chargedHold('hold-1', 0.42, 0, 'release')],
    ['a zero-cost sweep', () => chargedHold('hold-1', 0.42, 0, 'sweep')],
    [
      'an image hold',
      () => chargedHold('hold-1', 0.42, 0.2, 'settle', 'image'),
    ],
    [
      'an unfinalised hold',
      () => {
        chargedHold('hold-1', 0.42, 0.2);
        mockEvents.delete('hold:hold-1:final');
      },
    ],
  ])('writes nothing for %s', async (_label, arrange) => {
    arrange();
    await expect(quota.ensureVideoSpendLedgerRow('hold-1')).resolves.toBe(
      'not_charged'
    );
    expect(mockLedgerCreate).not.toHaveBeenCalled();
  });
});
