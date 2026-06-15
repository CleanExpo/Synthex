/**
 * invalidate-stats tests
 *
 * Proves the post-write cache invalidation that refreshes the dashboard-stats
 * lane:
 *  1. invalidatePostStats fires invalidateByTag('user:${userId}') (the tag the
 *     stats routes set) and the shared org tag.
 *  2. It is fire-and-forget safe: if the underlying cache invalidation throws,
 *     the helper resolves without throwing — so a post create/publish write can
 *     never be broken or rolled back by an invalidation failure.
 *
 * @module tests/unit/cache/invalidate-stats.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the cache manager so invalidateByTag is observable and controllable.
// InvalidationStrategy.invalidateByTag delegates to getCache().invalidateByTag.
const invalidateByTag = jest.fn<(tag: string) => Promise<number>>();

jest.mock('../../../lib/cache/cache-manager', () => ({
  getCache: () => ({ invalidateByTag }),
}));

// Silence logger output during the fire-and-forget failure test.
jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { invalidatePostStats } from '../../../lib/cache/invalidate-stats';

describe('invalidatePostStats', () => {
  beforeEach(() => {
    invalidateByTag.mockReset();
    invalidateByTag.mockResolvedValue(1);
  });

  it('invalidates the user tag the stats routes set (post create/publish)', async () => {
    await invalidatePostStats('user-123', 'org-abc');

    // The load-bearing tag for dashboard-stats refresh.
    expect(invalidateByTag).toHaveBeenCalledWith('user:user-123');
    // The shared org tag.
    expect(invalidateByTag).toHaveBeenCalledWith('org:org-abc');
  });

  it("falls back to the 'self' org sentinel when no org is given", async () => {
    await invalidatePostStats('user-123');

    expect(invalidateByTag).toHaveBeenCalledWith('user:user-123');
    expect(invalidateByTag).toHaveBeenCalledWith('org:self');
  });

  it('is a no-op when userId is missing (nothing safe to invalidate)', async () => {
    await invalidatePostStats(null);
    await invalidatePostStats(undefined);
    await invalidatePostStats('');

    expect(invalidateByTag).not.toHaveBeenCalled();
  });

  it('NEVER throws when invalidation fails (fire-and-forget write safety)', async () => {
    // Simulate Redis/cache failure during a post-write invalidation.
    invalidateByTag.mockRejectedValue(new Error('redis down'));

    // The helper must resolve, not reject — so the write that already succeeded
    // is never broken or rolled back by a failed cache invalidation.
    await expect(
      invalidatePostStats('user-123', 'org-abc')
    ).resolves.toBeUndefined();
  });
});
