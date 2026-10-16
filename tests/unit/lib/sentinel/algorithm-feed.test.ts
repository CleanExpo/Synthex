/**
 * @jest-environment node
 */
/**
 * Algorithm feed — Google Search Status Dashboard sync.
 *
 * The previous feed was a hand-written list that invented or mislabelled five
 * updates and missed every update after March 2026. These tests pin the
 * replacement: dashboard incidents map to rows exactly, a failed read is reported
 * as unavailable (never as an empty success), stored review state survives an
 * update, and the retracted ids never reach a query.
 *
 * Set LIVE_SENTINEL=1 to also run the check against the real dashboard feed.
 */

const mockPrisma = {
  algorithmUpdate: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type FeedModule = typeof import('@/lib/sentinel/algorithm-feed');

function loadFeed(): FeedModule {
  let mod: FeedModule | undefined;
  jest.isolateModules(() => {
    mod = require('@/lib/sentinel/algorithm-feed');
  });
  return mod as FeedModule;
}

const SEPT_2026_SPAM = {
  id: 'XhUDXP7A67iHCD2kmbVu',
  begin: '2026-09-24T16:15:00+00:00',
  end: '2026-10-08T08:00:00+00:00',
  external_desc: 'September 2026 spam update',
  service_name: 'Ranking',
  uri: 'incidents/XhUDXP7A67iHCD2kmbVu',
  most_recent_update: {
    text: 'The rollout was complete as of October 8, 2026.',
  },
};
const MAY_2026_CORE = {
  id: 'wdAXJk6LRRihEjpzEeWE',
  begin: '2026-05-21T15:40:00+00:00',
  end: null,
  external_desc: 'May 2026 core update',
  service_name: 'Ranking',
  uri: 'incidents/wdAXJk6LRRihEjpzEeWE',
};
const SERVING_ISSUE = {
  id: 'ServingIssue123',
  begin: '2026-02-25T10:00:00+00:00',
  end: '2026-02-25T20:00:00+00:00',
  external_desc: 'Serving was experiencing an issue',
  service_name: 'Serving',
  uri: 'incidents/ServingIssue123',
};

function okFetch(body: unknown): jest.Mock {
  return jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

const realFetch = global.fetch;
// The Jest config sets resetMocks: true, which strips implementations from
// mocks created outside a test. Every fetch mock is therefore built per test.
let offlineFetch: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.algorithmUpdate.upsert.mockResolvedValue({});
  mockPrisma.algorithmUpdate.findMany.mockResolvedValue([]);
  offlineFetch = jest
    .fn()
    .mockRejectedValue(new Error('network disabled in unit tests'));
  global.fetch = offlineFetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('mapStatusIncident', () => {
  it('maps a named ranking update to its seed id with dashboard dates and source', () => {
    const { mapStatusIncident } = loadFeed();
    expect(mapStatusIncident(SEPT_2026_SPAM)).toEqual({
      id: 'seed-september-2026-spam-update',
      update: {
        name: 'September 2026 spam update',
        updateType: 'spam',
        announcedAt: new Date('2026-09-24T16:15:00Z'),
        rolloutStart: new Date('2026-09-24T16:15:00Z'),
        rolloutEnd: new Date('2026-10-08T08:00:00Z'),
        impactLevel: 'medium',
        description: 'The rollout was complete as of October 8, 2026.',
        sourceUrl:
          'https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu',
      },
    });
  });

  it('marks a core update high impact and an ongoing rollout as open-ended', () => {
    const { mapStatusIncident } = loadFeed();
    const row = mapStatusIncident(MAY_2026_CORE);
    expect(row?.update.updateType).toBe('core');
    expect(row?.update.impactLevel).toBe('high');
    expect(row?.update.rolloutEnd).toBeNull();
    expect(row?.update.description).toBe('May 2026 core update');
  });

  it('keys non-ranking incidents by dashboard id as low-impact "other"', () => {
    const { mapStatusIncident } = loadFeed();
    const row = mapStatusIncident(SERVING_ISSUE);
    expect(row?.id).toBe('gssd-ServingIssue123');
    expect(row?.update.updateType).toBe('other');
    expect(row?.update.impactLevel).toBe('low');
  });

  it('rejects incidents without an id, a name or a valid start', () => {
    const { mapStatusIncident } = loadFeed();
    expect(mapStatusIncident({ ...SEPT_2026_SPAM, id: undefined })).toBeNull();
    expect(
      mapStatusIncident({ ...SEPT_2026_SPAM, external_desc: '  ' })
    ).toBeNull();
    expect(
      mapStatusIncident({ ...SEPT_2026_SPAM, begin: 'not-a-date' })
    ).toBeNull();
  });
});

describe('syncLiveAlgorithmUpdates', () => {
  it('upserts every incident and reports the feed as live', async () => {
    const { syncLiveAlgorithmUpdates, SEARCH_STATUS_FEED_URL } = loadFeed();
    const fetchImpl = okFetch([SEPT_2026_SPAM, SERVING_ISSUE]);

    const status = await syncLiveAlgorithmUpdates({ force: true, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      SEARCH_STATUS_FEED_URL,
      expect.any(Object)
    );
    expect(status).toMatchObject({ status: 'live', incidents: 2 });
    expect(status.lastLiveAt).toBe(status.checkedAt);
    const ids = mockPrisma.algorithmUpdate.upsert.mock.calls.map(
      ([arg]) => arg.where.id
    );
    expect(ids).toEqual([
      'seed-september-2026-spam-update',
      'gssd-ServingIssue123',
    ]);
  });

  it('leaves impact level and Sentinel review columns untouched on existing rows', async () => {
    const { syncLiveAlgorithmUpdates } = loadFeed();
    await syncLiveAlgorithmUpdates({
      force: true,
      fetchImpl: okFetch([SEPT_2026_SPAM]),
    });

    const [{ update, create }] =
      mockPrisma.algorithmUpdate.upsert.mock.calls[0];
    expect(Object.keys(update).sort()).toEqual(
      [
        'announcedAt',
        'description',
        'name',
        'rolloutEnd',
        'rolloutStart',
        'sourceUrl',
        'updateType',
      ].sort()
    );
    expect(create.impactLevel).toBe('medium');
  });

  it.each([
    [
      'a network failure',
      () => jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')),
      'getaddrinfo ENOTFOUND',
    ],
    [
      'an HTTP error',
      () =>
        jest.fn().mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({}),
        }),
      'HTTP 503',
    ],
    [
      'a non-array payload',
      () => okFetch({ error: 'nope' }),
      'feed payload is not an array',
    ],
    ['an empty feed', () => okFetch([]), 'feed returned no usable incidents'],
  ])(
    'reports %s as unavailable without writing or throwing',
    async (_label, makeFetch, expectedError) => {
      const { syncLiveAlgorithmUpdates, getAlgorithmFeedStatus } = loadFeed();
      const fetchImpl = makeFetch();

      const status = await syncLiveAlgorithmUpdates({ force: true, fetchImpl });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(status.status).toBe('unavailable');
      // The exact reason: an unrelated TypeError must not satisfy this case.
      expect(status.error).toBe(expectedError);
      expect(status.incidents).toBe(0);
      expect(mockPrisma.algorithmUpdate.upsert).not.toHaveBeenCalled();
      expect(getAlgorithmFeedStatus().status).toBe('unavailable');
    }
  );

  it('does not refetch within the sync interval unless forced', async () => {
    const { syncLiveAlgorithmUpdates } = loadFeed();
    const fetchImpl = okFetch([SEPT_2026_SPAM]);

    await syncLiveAlgorithmUpdates({ fetchImpl });
    const second = await syncLiveAlgorithmUpdates({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('live');

    await syncLiveAlgorithmUpdates({ force: true, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('verified fallback list and retracted seeds', () => {
  it('contains only dashboard incidents and none of the retracted ids', () => {
    const { KNOWN_ALGORITHM_UPDATES, RETRACTED_SEED_IDS } = loadFeed();
    expect(KNOWN_ALGORITHM_UPDATES).toHaveLength(18);
    for (const u of KNOWN_ALGORITHM_UPDATES) {
      expect(u.sourceUrl).toMatch(
        /^https:\/\/status\.search\.google\.com\/incidents\/\w+$/
      );
      expect(RETRACTED_SEED_IDS).not.toContain(
        `seed-${u.name.toLowerCase().replace(/\s+/g, '-')}`
      );
      expect(u.rolloutEnd!.getTime()).toBeGreaterThan(
        u.rolloutStart!.getTime()
      );
    }
  });

  it.each(['getRecentUpdates', 'getActiveRollouts', 'getAllUpdates'] as const)(
    '%s excludes the retracted seed ids',
    async fn => {
      const feed = loadFeed();
      await feed[fn]();
      const [{ where }] = mockPrisma.algorithmUpdate.findMany.mock.calls[0];
      expect(where.id).toEqual({ notIn: feed.RETRACTED_SEED_IDS });
      expect(offlineFetch).toHaveBeenCalledTimes(1);
      expect(feed.getAlgorithmFeedStatus()).toMatchObject({
        status: 'unavailable',
        error: 'network disabled in unit tests',
      });
      expect(feed.RETRACTED_SEED_IDS).toContain(
        'seed-february-2026-helpful-content-update'
      );
    }
  );
});

describe('seedAlgorithmUpdates', () => {
  it('creates missing fallback rows but never overwrites a stored row', async () => {
    // A named ranking update from the live feed is stored under the same seed
    // id as its fallback entry. A cold process must not replace those live
    // dates and descriptions with the fallback's; it may only fill gaps.
    const feed = loadFeed();
    await feed.seedAlgorithmUpdates();

    const calls = mockPrisma.algorithmUpdate.upsert.mock.calls.map(
      ([arg]) => arg
    );
    // The live read is offline here, so every write is a seed write.
    expect(offlineFetch).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(feed.KNOWN_ALGORITHM_UPDATES.length);
    for (const call of calls) {
      expect(call.update).toEqual({});
      expect(call.create).toMatchObject({
        id: call.where.id,
        name: expect.any(String),
        announcedAt: expect.any(Date),
        impactLevel: expect.any(String),
      });
    }
  });
});

const liveIt = process.env.LIVE_SENTINEL === '1' ? it : it.skip;

describe('live dashboard (LIVE_SENTINEL=1)', () => {
  liveIt(
    'maps the September 2026 spam update from the real feed',
    async () => {
      const { syncLiveAlgorithmUpdates } = loadFeed();
      const status = await syncLiveAlgorithmUpdates({
        force: true,
        fetchImpl: realFetch,
      });
      expect(status.status).toBe('live');

      const row = mockPrisma.algorithmUpdate.upsert.mock.calls
        .map(([arg]) => arg)
        .find(arg => arg.where.id === 'seed-september-2026-spam-update');
      expect(row?.create).toMatchObject({
        rolloutStart: new Date('2026-09-24T16:15:00Z'),
        rolloutEnd: new Date('2026-10-08T08:00:00Z'),
        sourceUrl:
          'https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu',
      });
    },
    20_000
  );
});
