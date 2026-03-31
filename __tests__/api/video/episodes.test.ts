/**
 * Unit tests for GET /api/video/episodes
 *
 * Covers: auth gate, happy path with series+episodes, empty DB state.
 *
 * Mock strategy:
 * - @/lib/security/api-security-checker: APISecurityChecker.check() returns
 *   allowed/denied based on test setup
 * - @/lib/prisma: prisma.videoSeries, prisma.videoEpisode,
 *   prisma.videoTopicQueue mocked
 * - @/lib/logger: silent mocks
 */

// ── Mock objects ──────────────────────────────────────────────────────────────

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn();

const mockVideoSeries = { findMany: jest.fn() };
const mockVideoEpisode = { findMany: jest.fn() };
const mockVideoTopicQueue = { groupBy: jest.fn() };

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: mockSecurityCheck,
    createSecureResponse: mockCreateSecureResponse,
  },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: 'authenticated_read' },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    videoSeries: mockVideoSeries,
    videoEpisode: mockVideoEpisode,
    videoTopicQueue: mockVideoTopicQueue,
  },
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
      const status = init?.status ?? 200;
      return new NextResponse(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  mockCreateSecureResponse.mockImplementation(
    (body: unknown, status?: number) => NextResponse.json(body, { status })
  );

  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): Request {
  return {
    method: 'GET',
    url: 'https://synthex.social/api/video/episodes',
    headers: { get: () => null },
  } as unknown as Request;
}

async function parseJson(r: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await r.text()) as Record<string, unknown>;
}

function loadRoute() {
  jest.resetModules();
  return require('@/app/api/video/episodes/route') as {
    GET: (req: Request) => Promise<Response>;
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SERIES_BTS = {
  id: 'series-bts-01',
  slug: 'behind-the-scenes',
  name: 'Behind the Scenes',
  seriesType: 'bts',
  status: 'active',
  nextEpisodeNum: 3,
  youtubePlaylistId: null,
  organisationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const EPISODE_PUBLISHED = {
  id: 'ep-01',
  seriesId: 'series-bts-01',
  episodeNumber: 1,
  title: 'How Synthex Tracks Rankings in Real Time',
  slug: 'behind-the-scenes-ep-1-how-synthex-tracks',
  status: 'published',
  humannessScore: 82.5,
  geoTacticScore: 65.0,
  slopScanPassed: true,
  youtubeVideoId: 'abc123',
  youtubeUrl: 'https://youtu.be/abc123',
  blogPostUrl: 'https://synthex.social/blog/video/bts/ep-1',
  errorMessage: null,
  scriptedAt: new Date('2026-03-10'),
  capturedAt: new Date('2026-03-10'),
  publishedAt: new Date('2026-03-11'),
  createdAt: new Date('2026-03-10'),
  socialPosts: { linkedin: {}, twitter: {}, instagram: {} },
};

const EPISODE_HELD = {
  ...EPISODE_PUBLISHED,
  id: 'ep-02',
  episodeNumber: 2,
  status: 'held',
  youtubeVideoId: null,
  youtubeUrl: null,
  blogPostUrl: null,
  publishedAt: null,
  errorMessage: 'Quality gate: humanness 58 < 70',
  socialPosts: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/video/episodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 401: unauthenticated ───────────────────────────────────────────────────

  describe('when request is unauthenticated', () => {
    it('returns 401', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Authentication required',
        context: {},
      });

      const { GET } = loadRoute();
      const response = await GET(makeRequest());

      expect(response.status).toBe(401);
      expect(mockVideoSeries.findMany).not.toHaveBeenCalled();
    });
  });

  // ── 403: authenticated but forbidden ─────────────────────────────────────

  describe('when request is authenticated but forbidden', () => {
    it('returns 403', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Forbidden',
        context: { userId: 'user-1' },
      });

      const { GET } = loadRoute();
      const response = await GET(makeRequest());

      expect(response.status).toBe(403);
      expect(mockVideoSeries.findMany).not.toHaveBeenCalled();
    });
  });

  // ── 200: no series configured ─────────────────────────────────────────────

  describe('when authenticated and no series exist', () => {
    it('returns empty series array with zero summary', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-1' },
      });
      mockVideoSeries.findMany.mockResolvedValue([]);
      mockVideoEpisode.findMany.mockResolvedValue([]);
      mockVideoTopicQueue.groupBy.mockResolvedValue([]);

      const { GET } = loadRoute();
      const response = await GET(makeRequest());
      expect(response.status).toBe(200);

      const body = await parseJson(response);
      expect(body.series).toEqual([]);
      expect(body.episodes).toEqual([]);
      expect((body.summary as Record<string, number>).total).toBe(0);
    });
  });

  // ── 200: happy path with series + episodes ────────────────────────────────

  describe('when authenticated with series and episodes', () => {
    beforeEach(() => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-1' },
      });
      mockVideoSeries.findMany.mockResolvedValue([SERIES_BTS]);
      mockVideoEpisode.findMany.mockResolvedValue([
        EPISODE_PUBLISHED,
        EPISODE_HELD,
      ]);
      mockVideoTopicQueue.groupBy.mockResolvedValue([
        { seriesId: 'series-bts-01', status: 'pending', _count: { id: 5 } },
        { seriesId: 'series-bts-01', status: 'assigned', _count: { id: 2 } },
      ]);
    });

    it('returns series with queue depth', async () => {
      const { GET } = loadRoute();
      const response = await GET(makeRequest());
      const body = await parseJson(response);

      const series = body.series as Array<Record<string, unknown>>;
      expect(series).toHaveLength(1);
      expect(series[0].slug).toBe('behind-the-scenes');
      expect(series[0].queueDepth).toBe(5); // only 'pending' count
      expect(series[0].totalTopics).toBe(7); // pending + assigned
      expect(series[0].nextEpisodeNum).toBe(3);
    });

    it('returns episodes with socialPostsCount summarised', async () => {
      const { GET } = loadRoute();
      const response = await GET(makeRequest());
      const body = await parseJson(response);

      const episodes = body.episodes as Array<Record<string, unknown>>;
      expect(episodes).toHaveLength(2);

      const published = episodes.find(e => e.status === 'published')!;
      expect(published.socialPostsCount).toBe(3); // linkedin, twitter, instagram
      expect(published.youtubeUrl).toBe('https://youtu.be/abc123');
      expect(published.humannessScore).toBeCloseTo(82.5);
      expect(published.geoTacticScore).toBeCloseTo(65.0);
      expect(published.slopScanPassed).toBe(true);

      const held = episodes.find(e => e.status === 'held')!;
      expect(held.socialPostsCount).toBe(0); // null socialPosts
      expect(held.errorMessage).toBe('Quality gate: humanness 58 < 70');
    });

    it('returns correct status summary including heldCount', async () => {
      const { GET } = loadRoute();
      const response = await GET(makeRequest());
      const body = await parseJson(response);

      const summary = body.summary as Record<string, number>;
      expect(summary.published).toBe(1);
      expect(summary.held).toBe(1);
      expect(summary.heldCount).toBe(1);
      expect(summary.total).toBe(2);
    });
  });

  // ── 500: database error ───────────────────────────────────────────────────

  describe('when database throws', () => {
    it('returns 500 with error details', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-1' },
      });
      mockVideoSeries.findMany.mockRejectedValue(
        new Error('DB connection lost')
      );

      const { GET } = loadRoute();
      const response = await GET(makeRequest());

      expect(response.status).toBe(500);
      const body = await parseJson(response);
      expect(body.error).toBe('Failed to load episodes');
      expect(body.details).toContain('DB connection lost');
    });
  });
});
