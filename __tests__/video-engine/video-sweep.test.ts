/** @jest-environment node */
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
// SYN-1115: the sweep also finalises stale reservations in the spend log.
const mockFindStale = jest.fn();
const mockFinalizeSpend = jest.fn();
jest.mock('@/lib/services/ai/image/spend-log', () => ({
  findStaleReservations: (...a: unknown[]) => mockFindStale(...(a as [])),
  finalizeSpend: (...a: unknown[]) => mockFinalizeSpend(...(a as [])),
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
jest.mock('@/lib/services/ai/video/quota', () => ({
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
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
});
