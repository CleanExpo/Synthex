/** @jest-environment node */
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
// SYN-1115: the sweep also reconciles stranded media spend holds.
const mockHoldFindMany = jest.fn();
const mockHoldUpdateMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
    mediaSpendHold: {
      findMany: (...a: unknown[]) => mockHoldFindMany(...a),
      updateMany: (...a: unknown[]) => mockHoldUpdateMany(...a),
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
  mockHoldFindMany.mockResolvedValue([]);
  mockHoldUpdateMany.mockResolvedValue({ count: 1 });
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
    expect(mockRelease).toHaveBeenCalledWith('org1', 0.3, 'mcp');
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

// SYN-1115 round-2 review finding 2: the sweep is the recovery path that makes
// a stranded hold retryable in production, not just in principle.
describe('GET /api/cron/video-sweep — stranded media holds', () => {
  it('releases an open hold left past the stale threshold', async () => {
    mockHoldFindMany.mockResolvedValue([
      {
        id: 'hold-1',
        organizationId: 'org-1',
        heldUsd: 0.42,
        initiatedBy: 'studio',
      },
    ]);

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 1 });

    expect(mockRelease).toHaveBeenCalledWith('org-1', 0.42, 'studio');
    // Claimed with a status guard so a concurrent settle wins the race.
    expect(mockHoldUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-1', status: 'open' },
        data: { status: 'swept', settledUsd: 0 },
      })
    );
  });

  it('does not release when a concurrent settle already claimed the hold', async () => {
    mockHoldFindMany.mockResolvedValue([
      {
        id: 'hold-1',
        organizationId: 'org-1',
        heldUsd: 0.42,
        initiatedBy: 'studio',
      },
    ]);
    mockHoldUpdateMany.mockResolvedValue({ count: 0 });

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 0 });
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('puts the hold BACK to open when the release fails, so the next pass retries', async () => {
    mockHoldFindMany.mockResolvedValue([
      {
        id: 'hold-1',
        organizationId: 'org-1',
        heldUsd: 0.42,
        initiatedBy: 'studio',
      },
    ]);
    mockRelease.mockRejectedValueOnce(new Error('connection reset'));

    const res = await GET(req('Bearer cron-secret'));
    await expect(res.json()).resolves.toMatchObject({ reconciledHolds: 0 });

    // THE assertion: the headroom is not lost — the row is reopened.
    expect(mockHoldUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'hold-1', status: 'swept' },
        data: { status: 'open', settledUsd: null },
      })
    );
  });
});
