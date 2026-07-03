/** @jest-environment node */
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
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
