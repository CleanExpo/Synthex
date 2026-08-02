/** @jest-environment node */
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
// SYN-1115: the sweep also finalises stale reservations in the spend log.
const mockFindStale = jest.fn();
const mockFinalizeSpend = jest.fn();
// SYN-1115 round-7: the sweep now READS provider attempts to decide what a
// dead run cost, instead of writing it off at -held.
const mockSettlementAmount = jest.fn();
jest.mock('@/lib/services/ai/image/spend-log', () => ({
  findStaleReservations: (...a: unknown[]) => mockFindStale(...(a as [])),
  finalizeSpend: (...a: unknown[]) => mockFinalizeSpend(...(a as [])),
  settlementAmountUsd: (...a: unknown[]) => mockSettlementAmount(...(a as [])),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));
const mockRelease = jest.fn();
const mockSettleQuota = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
  settleQuota: (...a: unknown[]) => mockSettleQuota(...a),
}));

import { GET } from '@/app/api/cron/video-sweep/route';
import { NextRequest } from 'next/server';

const req = (auth?: string) =>
  new NextRequest('https://synthex.example/api/cron/video-sweep', {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'cron-secret';
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockFindMany.mockResolvedValue([]);
  mockFindStale.mockResolvedValue([]);
  mockFinalizeSpend.mockResolvedValue(true);
  mockSettlementAmount.mockResolvedValue(0);
  mockSettleQuota.mockResolvedValue(true);
});

describe('GET /api/cron/video-sweep', () => {
  it('401s without the cron secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('fails generative jobs stuck >30min and releases their holds', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: 'org1',
        spendHoldId: 'hold-1',
        estimatedCostUsd: 0.3,
        initiatedBy: 'mcp',
      },
    ]);
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(200);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.mode).toBe('generative');
    expect(where.status).toBe('generating');
    expect(where.updatedAt.lt).toBeInstanceOf(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'r1', status: 'generating' }),
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
    expect(mockRelease).toHaveBeenCalledWith('org1', 'hold-1', 0.3, 'mcp');
  });

  it('does not release quota when the transition lost a race', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: 'org1',
        estimatedCostUsd: 0.3,
        initiatedBy: 'studio',
      },
    ]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
    await GET(req('Bearer cron-secret'));
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('skips quota release for rows without organizationId', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: null,
        estimatedCostUsd: 0.3,
        initiatedBy: 'studio',
      },
    ]);
    await GET(req('Bearer cron-secret'));
    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

// SYN-1115 round-4 refactor: the sweep appends ONE terminal event keyed on the
// hold, shared with settle and release. The previous counter-based sweep could
// subtract spend that had actually happened and could race a real settlement
// into a double-subtract; neither is expressible now.
describe('GET /api/cron/video-sweep — stale spend reservations', () => {
  const staleReservation = {
    holdId: 'hold-1',
    organizationId: 'org-1',
    initiatedBy: 'studio' as const,
    heldUsd: 0.42,
    // A video hold whose linked job never got a provider job id: nothing
    // reached a provider, PROVEN by the row's existence, so the floor is 0.
    submittedToProvider: false,
    hasOwnerRow: true,
  };

  it('finalises a reservation left past the stale threshold', async () => {
    mockFindStale.mockResolvedValue([staleReservation]);

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 1 });

    expect(mockFinalizeSpend).toHaveBeenCalledWith(
      expect.objectContaining({
        holdId: 'hold-1',
        organizationId: 'org-1',
        heldUsd: 0.42,
        kind: 'sweep',
      })
    );
  });

  it('CHARGES a dead run for what its attempts actually cost', async () => {
    // The round-5/6 erase defect: the sweep used to write -held for any stale
    // reservation, recording ZERO for calls the provider had already billed.
    mockFindStale.mockResolvedValue([staleReservation]);
    mockSettlementAmount.mockResolvedValue(0.105);

    await GET(req('Bearer cron-secret'));

    expect(mockSettlementAmount).toHaveBeenCalledWith('hold-1', 0.42, 0);
    expect(mockFinalizeSpend).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-1', actualUsd: 0.105 })
    );
  });

  it('charges a submitted run even when its attempt row was LOST', async () => {
    // SYN-1115 round-8. `recordAttempt` is best-effort at every call site, so
    // an empty attempt table is ambiguous between "nothing reached a provider"
    // and "we failed to write it down". A linked job holding a provider job id
    // settles that ambiguity from the database itself: fal accepted a submit,
    // so the sweep must charge for at least one call rather than erase it.
    mockFindStale.mockResolvedValue([
      { ...staleReservation, submittedToProvider: true },
    ]);
    mockSettlementAmount.mockResolvedValue(0.42);

    await GET(req('Bearer cron-secret'));

    expect(mockSettlementAmount).toHaveBeenCalledWith('hold-1', 0.42, 1);
  });

  it('counts nothing when a real settlement already finalised the hold', async () => {
    mockFindStale.mockResolvedValue([staleReservation]);
    // The log reports the key was already taken — the settlement won.
    mockFinalizeSpend.mockResolvedValue(false);

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 0 });
    // THE property: the sweep cannot subtract spend that really happened,
    // because it cannot write a second terminal event for that hold.
  });

  it('leaves the reservation unterminated when the append fails, so the next pass retries', async () => {
    mockFindStale.mockResolvedValue([staleReservation]);
    mockFinalizeSpend.mockRejectedValueOnce(new Error('connection reset'));

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 0 });
    // Nothing to unwind — an append either happened or it did not.
  });

  it('does not charge an unlinked hold on absence of a link alone', async () => {
    // Charging unlinked holds their full reservation was tried and REVERTED.
    // "No owner row" does not mean "image": every video variant is reserved
    // before the submit loop creates any row, so a pre-submit failure leaves an
    // unlinked video hold that provably never called a provider. Charging on
    // absence of a link turned those into recorded spend.
    mockFindStale.mockResolvedValue([
      { ...staleReservation, submittedToProvider: false, hasOwnerRow: false },
    ]);
    mockSettlementAmount.mockResolvedValue(0);

    await GET(req('Bearer cron-secret'));

    // Same floor as any other hold with nothing to prove a call was made.
    expect(mockSettlementAmount).toHaveBeenCalledWith('hold-1', 0.42, 0);
    expect(mockFinalizeSpend).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-1', actualUsd: 0, kind: 'sweep' })
    );
  });

  it('still settles an unlinked hold from its attempts when they SURVIVED', async () => {
    // The failure mode of the fix above, caught in review: skipping
    // settlementAmountUsd for unlinked holds threw away real evidence. A run
    // that died after one of several reserved calls would then be charged for
    // all of them. Recorded attempts must stay authoritative.
    mockFindStale.mockResolvedValue([
      { ...staleReservation, submittedToProvider: false, hasOwnerRow: false },
    ]);
    mockSettlementAmount.mockResolvedValue(0.07);

    await GET(req('Bearer cron-secret'));

    expect(mockFinalizeSpend).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: 'hold-1', actualUsd: 0.07 })
    );
  });

  it('CHARGES a stale job that was submitted, instead of refunding it', async () => {
    // SYN-1115 round-8, seventh review pass. This loop used to release EVERY
    // stale job's hold in full, and a release takes the shared
    // `hold:{id}:final` key — so reconcileStaleReservations, which runs after
    // it and skips holds that already have a terminal event, could never see
    // the hold. The submitted-call floor added for exactly this case was
    // therefore unreachable in production: a stale job with a provider job id
    // and a lost attempt row had its paid submit refunded.
    //
    // Both phases had tests and both passed; neither exercised the ORDERING.
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: 'org1',
        spendHoldId: 'hold-1',
        providerJobId: 'fal-req-1',
        estimatedCostUsd: 0.3,
        initiatedBy: 'studio',
      },
    ]);
    // No attempt row survived, so settlement falls back to the reservation
    // rate for the one call the provider job id proves was made.
    mockSettlementAmount.mockResolvedValue(0.3);

    await GET(req('Bearer cron-secret'));

    expect(mockSettlementAmount).toHaveBeenCalledWith('hold-1', 0.3, 1);
    expect(mockSettleQuota).toHaveBeenCalledWith(
      'org1',
      'hold-1',
      0.3,
      0.3,
      'studio'
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('still RELEASES a stale job that never reached the provider', async () => {
    // The other half: no provider job id means fal never accepted a submit, so
    // nothing can have been billed and the hold must be returned in full. The
    // fix above must not turn every stale job into a charge.
    mockFindMany.mockResolvedValue([
      {
        id: 'r1',
        organizationId: 'org1',
        spendHoldId: 'hold-1',
        providerJobId: null,
        estimatedCostUsd: 0.3,
        initiatedBy: 'studio',
      },
    ]);

    await GET(req('Bearer cron-secret'));

    expect(mockRelease).toHaveBeenCalledWith('org1', 'hold-1', 0.3, 'studio');
    expect(mockSettleQuota).not.toHaveBeenCalled();
  });
});
