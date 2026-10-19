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
  claimQueueItemForPublish,
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
  // SEAM: reclaimStalePublishingQueueItems + claimQueueItemForPublish, driven
  // against a minimal in-memory publishQueueItem row (Prisma is the boundary).
  // Catches: a row whose platform call may already have succeeded (worker died
  // in 'publishing') being made claimable/due again → double post (JEV J8
  // crash-retry). Misses: the processPublishQueue due-fetch itself (JEV J8).
  type QRow = Record<string, unknown>;
  const matches = (row: QRow, where: Record<string, any>): boolean =>
    Object.entries(where).every(([k, cond]) => {
      if (k === 'OR') return (cond as any[]).some(w => matches(row, w));
      const v = row[k] as any;
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('in' in cond && !cond.in.includes(v)) return false;
        if ('lt' in cond && !(v != null && v < cond.lt)) return false;
        if ('lte' in cond && !(v != null && v <= cond.lte)) return false;
        return true;
      }
      return v === cond;
    });
  function useRows(rows: QRow[]) {
    mockPrisma.publishQueueItem.updateMany.mockImplementation(
      async ({ where, data }: { where: Record<string, any>; data: QRow }) => {
        const hit = rows.filter(r => matches(r, where));
        hit.forEach(r => Object.assign(r, data, { updatedAt: new Date() }));
        return { count: hit.length };
      }
    );
  }
  const now = new Date('2030-06-01T12:00:00.000Z');
  const staleRow = (): QRow => ({
    id: 'qi1',
    status: PUBLISHING_STATUS,
    nextRetryAt: null,
    lastError: null,
    attempts: 0,
    updatedAt: new Date(now.getTime() - STALE_CLAIM_MS - 1000),
  });

  it('a row stranded in publishing (outcome unknown) can never be claimed again', async () => {
    const row = staleRow();
    useRows([row]);

    await expect(reclaimStalePublishingQueueItems(now)).resolves.toBe(1);

    await expect(claimQueueItemForPublish('qi1')).resolves.toBe(false);
  });

  it('marks it failed with no scheduled retry and says a person must check the platform', async () => {
    const row = staleRow();
    useRows([row]);

    await reclaimStalePublishingQueueItems(now);

    expect(row).toEqual(
      expect.objectContaining({
        status: 'failed',
        nextRetryAt: null,
        attempts: 0,
        lastError: expect.stringMatching(
          /outcome unknown.*check the platform/i
        ),
      })
    );
  });

  it('leaves a row still inside the stale window to its worker', async () => {
    const row = { ...staleRow(), updatedAt: new Date(now.getTime() - 60_000) };
    useRows([row]);

    await expect(reclaimStalePublishingQueueItems(now)).resolves.toBe(0);
    expect(row.status).toBe(PUBLISHING_STATUS);
  });

  it('a row that failed BEFORE dispatch keeps its normal retry once due', async () => {
    const row: QRow = {
      id: 'qi1',
      status: 'failed',
      lastError: 'Publish failed',
      attempts: 1,
      nextRetryAt: new Date(Date.now() - 1000),
    };
    useRows([row]);

    await expect(claimQueueItemForPublish('qi1')).resolves.toBe(true);
  });

  it('(control: planted failure is caught) a failed row with no retry time stays unclaimable', async () => {
    // The planted defect is the old reclaim (nextRetryAt=now). Rows written
    // that way must be claimable, proving the claim test above can go red.
    const planted: QRow = {
      ...staleRow(),
      status: 'failed',
      nextRetryAt: new Date(),
    };
    const unknown: QRow = { ...staleRow(), id: 'qi2', status: 'failed' };
    useRows([planted, unknown]);

    await expect(claimQueueItemForPublish('qi1')).resolves.toBe(true);
    await expect(claimQueueItemForPublish('qi2')).resolves.toBe(false);
  });
});

describe('claimQueueItemForPublish', () => {
  it('issues a single conditional updateMany on the item that flips it to publishing', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 1 });

    await claimQueueItemForPublish('qi1');

    expect(mockPrisma.publishQueueItem.updateMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.publishQueueItem.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual(expect.objectContaining({ id: 'qi1' }));
    expect(arg.data.status).toBe(PUBLISHING_STATUS);
  });

  it('returns true when exactly one row is claimed (count 1)', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 1 });
    await expect(claimQueueItemForPublish('qi1')).resolves.toBe(true);
  });

  it('returns false when the item was already claimed by another worker (count 0)', async () => {
    mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimQueueItemForPublish('qi1')).resolves.toBe(false);
  });

  it('TWO CONCURRENT CLAIMS → only ONE wins (the other dispatches nothing)', async () => {
    // The DB lets exactly one writer flip pending/failed -> publishing. The
    // first updateMany sees count 1, the second (overlapping queue pass / retry
    // / second instance) sees count 0 and must skip without dispatching.
    mockPrisma.publishQueueItem.updateMany
      .mockResolvedValueOnce({ count: 1 }) // worker A wins
      .mockResolvedValueOnce({ count: 0 }); // worker B loses

    const [a, b] = await Promise.all([
      claimQueueItemForPublish('qi1'),
      claimQueueItemForPublish('qi1'),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(a !== b).toBe(true);
  });
});
