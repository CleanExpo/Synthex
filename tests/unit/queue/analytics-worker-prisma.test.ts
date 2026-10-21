/** @jest-environment node */

/**
 * p2-u14: the analytics worker reads the connection through Prisma, scoped to
 * the job's user. platform_analytics_snapshots is not provisioned, so after
 * collecting it records metrics on the connection and fails with a named error.
 */

const mockPrisma = {
  platformConnection: { findFirst: jest.fn(), updateMany: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('bullmq', () => ({ Worker: jest.fn(), Job: jest.fn() }));
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string | null) => v,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  processAnalyticsCollection,
  AnalyticsSnapshotsNotProvisionedError,
} from '@/lib/queue/workers/analytics-worker';

function job(data: Record<string, unknown>) {
  return { id: 'job_1', data } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('analytics worker (Prisma port)', () => {
  it('looks the connection up scoped to the job user', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);

    await expect(
      processAnalyticsCollection(
        job({ userId: 'user_1', platform: 'twitter', connectionId: 'conn_1' })
      )
    ).rejects.toThrow('Connection conn_1 not found');

    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith({
      where: { id: 'conn_1', userId: 'user_1', deletedAt: null },
    });
  });

  it('NOT_PROVISIONED: saves metrics on the connection, then fails honestly', async () => {
    mockPrisma.platformConnection.findFirst
      .mockResolvedValueOnce({
        id: 'conn_1',
        userId: 'user_1',
        isActive: true,
        accessToken: 'tok',
        refreshToken: null,
        profileId: 'p1',
      })
      .mockResolvedValueOnce({ metadata: { kept: true } });

    const err = await processAnalyticsCollection(
      job({ userId: 'user_1', platform: 'twitter', connectionId: 'conn_1' })
    ).catch(e => e);

    expect(err).toBeInstanceOf(AnalyticsSnapshotsNotProvisionedError);
    expect(err.code).toBe('FEATURE_NOT_PROVISIONED');
    expect(err.table).toBe('platform_analytics_snapshots');

    expect(mockPrisma.platformConnection.updateMany).toHaveBeenCalledTimes(1);
    const update = mockPrisma.platformConnection.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: 'conn_1',
      userId: 'user_1',
      deletedAt: null,
    });
    expect(update.data.metadata).toEqual({
      kept: true,
      lastMetrics: { impressions: 0, engagements: 0, followers: 0 },
    });
  });
});

describe('analytics worker Facebook insights', () => {
  const originalFetch = global.fetch;
  const RETIRED = /^(page_impressions|page_engaged_users|page_fans)/;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function facebookConnection() {
    mockPrisma.platformConnection.findFirst
      .mockResolvedValueOnce({
        id: 'conn_1',
        userId: 'user_1',
        isActive: true,
        accessToken: 'tok',
        refreshToken: null,
        profileId: 'page-1',
      })
      .mockResolvedValueOnce({ metadata: {} });
  }

  function graphAnswers(body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('requests only current Page metrics and stores what was read', async () => {
    facebookConnection();
    const fetchMock = graphAnswers({
      data: [
        { name: 'page_media_view', values: [{ value: 50 }] },
        { name: 'page_post_engagements', values: [{ value: 7 }] },
        { name: 'page_follows', values: [{ value: 300 }] },
      ],
    });

    const err = await processAnalyticsCollection(
      job({ userId: 'user_1', platform: 'facebook', connectionId: 'conn_1' })
    ).catch(e => e);

    expect(err).toBeInstanceOf(AnalyticsSnapshotsNotProvisionedError);
    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    const names = (url.match(/[?&]metric=([^&]+)/)?.[1] ?? '').split(',');
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(n => RETIRED.test(n))).toEqual([]);
    const update = mockPrisma.platformConnection.updateMany.mock.calls[0][0];
    expect(update.data.metadata.lastMetrics).toEqual({
      impressions: null,
      views: 50,
      engagements: 7,
      followers: 300,
    });
  });

  it('an empty Graph answer is a failure, not zeros', async () => {
    facebookConnection();
    graphAnswers({ data: [] });

    await expect(
      processAnalyticsCollection(
        job({ userId: 'user_1', platform: 'facebook', connectionId: 'conn_1' })
      )
    ).rejects.toThrow('Facebook returned no metric values');
    // The failure is recorded as an error; no metrics (and no zeros) are kept.
    const writes = mockPrisma.platformConnection.updateMany.mock.calls.map(
      call => call[0].data.metadata
    );
    expect(writes).toEqual([
      { lastSyncError: 'Facebook returned no metric values' },
    ]);
  });
});
