/** @jest-environment node */

/**
 * p2-u14: content-engine reads post history through Prisma, scoped to the
 * caller's campaigns; the recommendation dismiss/apply tables are not
 * provisioned, so those report failure with the reason.
 */

const mockPrisma = {
  post: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { contentRecommendationEngine } from '@/lib/recommendations/content-engine';

beforeEach(() => jest.clearAllMocks());

describe('content-engine (Prisma port)', () => {
  it('reads format history from the caller-owned posts only', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        analytics: { likes: 8, comments: 1, shares: 1, impressions: 100 },
        metadata: { contentType: 'reels' },
        publishedAt: new Date('2026-10-01T10:00:00Z'),
      },
    ]);

    const rec = await contentRecommendationEngine.getFormatRecommendations(
      'user_1',
      'instagram'
    );

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
      where: {
        platform: 'instagram',
        deletedAt: null,
        campaign: { userId: 'user_1' },
      },
      select: { analytics: true, metadata: true, publishedAt: true },
    });
    expect(rec.platform).toBe('instagram');
    expect(rec.recommendedFormats.length).toBeGreaterThan(0);
  });

  it('NOT_PROVISIONED: dismiss is reported as not saved', async () => {
    expect(
      await contentRecommendationEngine.dismissRecommendation('user_1', 'rec_1')
    ).toBe(false);
  });

  it('NOT_PROVISIONED: apply reports failure with the missing table', async () => {
    const result = await contentRecommendationEngine.applyRecommendation(
      'user_1',
      'rec_1',
      { topic: 'x' }
    );

    expect(result.success).toBe(false);
    expect(result.result).toEqual({
      available: false,
      reason: expect.stringContaining('applied_recommendations'),
    });
  });
});
