/**
 * Unit coverage for the atomic publish-claim (lib/publish/postPublishClaim.ts).
 *
 * These tests lock the contract that closes the double-post window:
 *  - two concurrent claims on the same post → exactly ONE wins (count 1), the
 *    other gets count 0 and must NOT proceed to publish;
 *  - the claim is a conditional updateMany gated on status='scheduled';
 *  - a failed publish releases the claim back to 'scheduled' for retry;
 *  - the happy path claims exactly once;
 *  - stale 'publishing' posts (crashed worker) are reclaimed.
 *
 * The DB itself provides the atomicity in production; here we assert that the
 * code issues a single conditional write and respects its result, and we model
 * the race by having the conditional updateMany return count 1 for the winner
 * and count 0 for the loser.
 *
 * @task SYN-P1
 */

const mockPrisma = {
  post: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  publishQueueItem: {
    updateMany: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  claimPostForPublish,
  releasePostClaim,
  reclaimStalePublishingPosts,
  reclaimStalePublishingQueueItems,
  PUBLISHING_STATUS,
  STALE_CLAIM_MS,
} from '@/lib/publish/postPublishClaim';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.post.findUnique.mockResolvedValue({ metadata: {} });
});

describe('claimPostForPublish', () => {
  it('issues a conditional updateMany gated on scheduled + unpublished + not-deleted', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });

    await claimPostForPublish('p1');

    expect(mockPrisma.post.updateMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.post.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual(
      expect.objectContaining({
        id: 'p1',
        status: 'scheduled',
        publishedAt: null,
        deletedAt: null,
      })
    );
    expect(arg.data.status).toBe(PUBLISHING_STATUS);
    // claim marker recorded in metadata (no new column / no migration)
    expect(arg.data.metadata).toEqual(
      expect.objectContaining({ publishClaimedAt: expect.any(String) })
    );
  });

  it('returns true when exactly one row is claimed (count 1)', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
    await expect(claimPostForPublish('p1')).resolves.toBe(true);
  });

  it('returns false when the row was already claimed by another worker (count 0)', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimPostForPublish('p1')).resolves.toBe(false);
  });

  it('TWO CONCURRENT CLAIMS → only ONE wins (the other publishes nothing)', async () => {
    // Model the atomic conditional update: the DB lets exactly one writer flip
    // scheduled -> publishing. The first updateMany sees count 1, the second
    // (a concurrent worker / overlapping cron run / retry) sees count 0.
    mockPrisma.post.updateMany
      .mockResolvedValueOnce({ count: 1 }) // worker A wins
      .mockResolvedValueOnce({ count: 0 }); // worker B loses

    const [a, b] = await Promise.all([
      claimPostForPublish('p1'),
      claimPostForPublish('p1'),
    ]);

    // Exactly one winner — never both, never neither.
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(a !== b).toBe(true);
  });

  it('does NOT preserve a winning claim if the DB reports zero rows', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });
    const won = await claimPostForPublish('p1');
    // Critical: a loser must skip — returning false is what stops the second post.
    expect(won).toBe(false);
  });
});

describe('releasePostClaim', () => {
  it('releases a held claim back to scheduled (conditional on publishing)', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });

    const retryAt = new Date('2030-01-01T00:00:00.000Z');
    await releasePostClaim('p1', {
      scheduledAt: retryAt,
      existingMetadata: { keep: 'me' },
      metadata: { retryCount: 1 },
    });

    const arg = mockPrisma.post.updateMany.mock.calls[0][0];
    // Only ever release a row WE hold.
    expect(arg.where).toEqual({ id: 'p1', status: PUBLISHING_STATUS });
    expect(arg.data.status).toBe('scheduled');
    expect(arg.data.scheduledAt).toBe(retryAt);
    // existing metadata preserved + patch merged
    expect(arg.data.metadata).toEqual(
      expect.objectContaining({ keep: 'me', retryCount: 1 })
    );
  });

  it('is a no-op shape when not releasing metadata/scheduledAt', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
    await releasePostClaim('p1');
    const arg = mockPrisma.post.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'p1', status: PUBLISHING_STATUS });
    expect(arg.data).toEqual({ status: 'scheduled' });
  });
});

describe('reclaimStalePublishingPosts', () => {
  it('releases posts stuck in publishing past the stale window', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date('2030-06-01T12:00:00.000Z');

    const count = await reclaimStalePublishingPosts(now);

    expect(count).toBe(3);
    const arg = mockPrisma.post.updateMany.mock.calls[0][0];
    expect(arg.where.status).toBe(PUBLISHING_STATUS);
    expect(arg.where.updatedAt.lt).toEqual(
      new Date(now.getTime() - STALE_CLAIM_MS)
    );
    expect(arg.data.status).toBe('scheduled');
  });

  it('reports 0 when nothing is stale', async () => {
    mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });
    await expect(reclaimStalePublishingPosts(new Date())).resolves.toBe(0);
  });
});

describe('reclaimStalePublishingQueueItems', () => {
  it('releases queue items stuck in publishing past the stale window to failed+retry', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 2 });
    const now = new Date('2030-06-01T12:00:00.000Z');

    const count = await reclaimStalePublishingQueueItems(now);

    expect(count).toBe(2);
    const arg = mockPrisma.publishQueueItem.updateMany.mock.calls[0][0];
    // Only ever touch rows stranded in 'publishing'...
    expect(arg.where.status).toBe(PUBLISHING_STATUS);
    // ...and only ones older than the stale window — never yank an in-flight worker.
    expect(arg.where.updatedAt.lt).toEqual(
      new Date(now.getTime() - STALE_CLAIM_MS)
    );
    // Released to 'failed' with nextRetryAt=now so the queue's due-fetch
    // (status:'failed', nextRetryAt<=now) picks it up on this same pass.
    expect(arg.data.status).toBe('failed');
    expect(arg.data.nextRetryAt).toEqual(now);
    expect(arg.data.lastError).toEqual(expect.stringContaining('Reclaimed'));
  });

  it('does NOT increment attempts (the prior attempt outcome is unknown)', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 1 });
    await reclaimStalePublishingQueueItems(new Date());
    const arg = mockPrisma.publishQueueItem.updateMany.mock.calls[0][0];
    expect(arg.data.attempts).toBeUndefined();
  });

  it('reports 0 when nothing is stale', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reclaimStalePublishingQueueItems(new Date())
    ).resolves.toBe(0);
  });
});
