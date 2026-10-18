/**
 * P2 u12: posting-time-predictor reads the caller's published posts from
 * Prisma (`posts`), scoped through campaign.userId — not the noop stub.
 */
const findMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { post: { findMany: (...args: unknown[]) => findMany(...args) } },
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { postingTimePredictor } from '@/lib/ml/posting-time-predictor';

describe('postingTimePredictor (Prisma port)', () => {
  beforeEach(() => findMany.mockReset());

  it("queries only the caller's published, non-deleted posts for the platform", async () => {
    findMany.mockResolvedValue([]);
    const result = await postingTimePredictor.getOptimalTimes(
      'user-a',
      'linkedin',
      'UTC'
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      campaign: { userId: 'user-a' },
      platform: 'linkedin',
      status: 'published',
      deletedAt: null,
    });
    expect(args.where.publishedAt.gte).toBeInstanceOf(Date);
    expect(args.select).toEqual({ publishedAt: true, analytics: true });
    // No history: honest industry methodology with zero data points.
    expect(result.methodology).toBe('industry');
    expect(result.basedOnDataPoints).toBe(0);
  });

  it('uses real post analytics as historical data points', async () => {
    const at = new Date('2026-10-06T10:00:00Z');
    findMany.mockResolvedValue([
      {
        publishedAt: at,
        analytics: { impressions: 100, likes: 5, comments: 3, shares: 2 },
      },
      { publishedAt: at, analytics: null },
    ]);
    const result = await postingTimePredictor.getOptimalTimes(
      'user-b',
      'twitter',
      'UTC'
    );

    expect(findMany.mock.calls[0][0].where.campaign).toEqual({
      userId: 'user-b',
    });
    expect(result.methodology).toBe('hybrid');
    expect(result.basedOnDataPoints).toBe(1);
  });
});
