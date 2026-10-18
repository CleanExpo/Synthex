/**
 * P2 noop-client retirement — lib/analytics/trend-predictor.ts.
 *
 * scheduled_posts and platform_analytics_snapshots have no Prisma model, so
 * history-driven paths throw TrendDataNotProvisionedError. The reach estimate
 * is ported to prisma.platformConnection, scoped to the caller's own live
 * connection.
 */

const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformConnection: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  trendPredictor,
  TrendDataNotProvisionedError,
} from '@/lib/analytics/trend-predictor';

async function expectNotProvisioned(p: Promise<unknown>, table: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(TrendDataNotProvisionedError);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
}

describe('trendPredictor — NOT_PROVISIONED data paths', () => {
  it('predictTrends throws instead of returning no predictions', async () => {
    await expectNotProvisioned(
      trendPredictor.predictTrends('user-1'),
      'scheduled_posts'
    );
  });

  it('forecastEngagement and detectSeasonalPatterns throw', async () => {
    await expectNotProvisioned(
      trendPredictor.forecastEngagement('user-1', 'instagram'),
      'platform_analytics_snapshots'
    );
    await expectNotProvisioned(
      trendPredictor.detectSeasonalPatterns('user-1', 'instagram'),
      'platform_analytics_snapshots'
    );
  });

  it('forecastAllMetrics rethrows instead of returning an empty Map', async () => {
    await expectNotProvisioned(
      trendPredictor.forecastAllMetrics('user-1', 'instagram'),
      'platform_analytics_snapshots'
    );
  });

  it('predictContentPerformance throws', async () => {
    await expectNotProvisioned(
      trendPredictor.predictContentPerformance('user-1', {
        text: 'hi',
        platform: 'twitter',
      }),
      'scheduled_posts'
    );
  });
});

describe('trendPredictor — reach estimate ported to Prisma', () => {
  beforeEach(() => mockFindFirst.mockReset());

  it('reads only the caller’s live connection and uses metadata.lastMetrics.followers', async () => {
    mockFindFirst.mockResolvedValue({
      metadata: { lastMetrics: { followers: 20000 } },
    });

    const result = await trendPredictor.calculateViralPotential('user-7', {
      text: 'Launch day! #growth',
      hashtags: ['growth'],
      platform: 'instagram',
    });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-7',
        platform: 'instagram',
        isActive: true,
        deletedAt: null,
      },
      select: { metadata: true },
    });
    // baseReach = 20000 * 0.1 = 2000, scaled by (1 + score/100) >= 1.
    expect(result.estimatedReach!.medium).toBeGreaterThanOrEqual(2000);
    expect(result.estimatedReachUnavailable).toBeUndefined();
  });

  it('returns null reach with a note instead of inventing 1000 followers', async () => {
    mockFindFirst.mockResolvedValue({ metadata: {} });

    const result = await trendPredictor.calculateViralPotential('user-7', {
      text: 'Launch day! #growth',
      hashtags: ['growth'],
      platform: 'instagram',
    });

    expect(result.estimatedReach).toBeNull();
    expect(result.estimatedReachUnavailable).toContain('follower count');
  });
});
