/**
 * Video sweep — a CHARGED sweep gets its pipeline_cost_ledger row.
 *
 * reconcileStaleReservations finalises a stale hold with kind 'sweep' through
 * finalizeSpend directly, which bypasses settleQuota, the only video path that
 * wrote the ledger. A paid video sweep therefore moved media_spend_events
 * without leaving an audit row. The sweep now writes the same row for a
 * charged video hold, keeps the zero-cost path row-free, and leaves image holds
 * to their own ledger path. Each pass also runs the ledger backfill.
 */

const mockFindStaleReservations = jest.fn();
const mockSettlementAmountUsd = jest.fn();
const mockFinalizeSpend = jest.fn();
jest.mock('@/lib/services/ai/image/spend-log', () => ({
  findStaleReservations: (...a: unknown[]) => mockFindStaleReservations(...a),
  settlementAmountUsd: (...a: unknown[]) => mockSettlementAmountUsd(...a),
  finalizeSpend: (...a: unknown[]) => mockFinalizeSpend(...a),
}));

const mockEnsureLedgerRow = jest.fn();
const mockBackfillLedger = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  VIDEO_LEDGER_BACKFILL_LOOKBACK_MS: 48 * 60 * 60 * 1000,
  ensureVideoSpendLedgerRow: (...a: unknown[]) => mockEnsureLedgerRow(...a),
  backfillVideoSpendLedger: (...a: unknown[]) => mockBackfillLedger(...a),
  releaseQuota: jest.fn(),
  settleQuota: jest.fn(),
}));

const mockVideoFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockVideoFindMany(...a),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  getFalResult: jest.fn(),
  getFalStatus: jest.fn(),
}));
jest.mock('@/lib/services/ai/video/fal-completion', () => ({
  completeFalSuccess: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/video-sweep/route';

function staleHold(
  holdId: string,
  mediaType: 'video' | 'image',
  extra: Record<string, unknown> = {}
) {
  return {
    holdId,
    organizationId: 'org-1',
    initiatedBy: 'studio',
    heldUsd: 0.42,
    submittedToProvider: true,
    hasOwnerRow: true,
    mediaType,
    ...extra,
  };
}

async function runSweep() {
  const res = await GET({} as NextRequest);
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVideoFindMany.mockResolvedValue([]);
  mockFinalizeSpend.mockResolvedValue(true);
  mockEnsureLedgerRow.mockResolvedValue('written');
  mockBackfillLedger.mockResolvedValue(0);
});

describe('video sweep — ledger rows for charged sweeps', () => {
  it('a charged video sweep writes the ledger row for its hold', async () => {
    mockFindStaleReservations.mockResolvedValue([staleHold('hold-v', 'video')]);
    mockSettlementAmountUsd.mockResolvedValue(0.3);

    await runSweep();

    expect(mockFinalizeSpend).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-v', kind: 'sweep' })
    );
    expect(mockEnsureLedgerRow).toHaveBeenCalledWith('hold-v');
  });

  it('control: a zero-cost video sweep (provably never submitted) writes no row', async () => {
    mockFindStaleReservations.mockResolvedValue([
      staleHold('hold-0', 'video', { submittedToProvider: false }),
    ]);
    mockSettlementAmountUsd.mockResolvedValue(0);

    await runSweep();

    expect(mockFinalizeSpend).toHaveBeenCalled();
    expect(mockEnsureLedgerRow).not.toHaveBeenCalled();
  });

  it('control: a charged IMAGE sweep is not written as video spend', async () => {
    mockFindStaleReservations.mockResolvedValue([staleHold('hold-i', 'image')]);
    mockSettlementAmountUsd.mockResolvedValue(0.3);

    await runSweep();

    expect(mockEnsureLedgerRow).not.toHaveBeenCalled();
  });

  it('a sweep that lost the finalise race writes nothing (the winner owns it)', async () => {
    mockFindStaleReservations.mockResolvedValue([staleHold('hold-v', 'video')]);
    mockSettlementAmountUsd.mockResolvedValue(0.3);
    mockFinalizeSpend.mockResolvedValue(false);

    await runSweep();

    expect(mockEnsureLedgerRow).not.toHaveBeenCalled();
  });

  it('a failed ledger write does not fail the sweep, and the backfill still runs', async () => {
    mockFindStaleReservations.mockResolvedValue([staleHold('hold-v', 'video')]);
    mockSettlementAmountUsd.mockResolvedValue(0.3);
    mockEnsureLedgerRow.mockRejectedValue(new Error('ledger down'));
    mockBackfillLedger.mockResolvedValue(0);

    const body = await runSweep();

    expect(body.reconciledHolds).toBe(1);
    expect(mockBackfillLedger).toHaveBeenCalledWith(expect.any(Date));
  });

  it('every pass runs the ledger backfill over the lookback window', async () => {
    mockFindStaleReservations.mockResolvedValue([]);
    mockBackfillLedger.mockResolvedValue(2);
    const before = Date.now();

    const body = await runSweep();

    expect(body.ledgerBackfilled).toBe(2);
    const since = (mockBackfillLedger.mock.calls[0][0] as Date).getTime();
    expect(before - since).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 1000);
  });
});
