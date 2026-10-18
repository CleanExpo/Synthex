/**
 * P2 / retire the noop-client stub — direct social post routes.
 *
 * reddit / threads / tiktok / youtube used the throwing noop Supabase client
 * for `platform_connections` + `social_posts` + `usage_tracking`. They now:
 *   - read the caller's own PlatformConnection (userId + effective org + active),
 *   - record posts in PlatformPost keyed by that connection,
 *   - report usage metering as not recorded (usage_tracking has no model).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

const securityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => securityCheck(...a),
    createSecureResponse: jest.fn(),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {}, AUTHENTICATED_READ: {} },
}));

const getUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserId(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/security/validate-url', () => ({
  validateExternalUrl: jest.fn(),
}));

jest.mock('@/lib/social/schedule-via-post', () => ({
  scheduleViaPost: jest.fn(),
}));

const decryptField = jest.fn();
jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: (...a: unknown[]) => decryptField(...a),
}));

const getEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) =>
    getEffectiveOrganizationId(...a),
}));

const createPost = jest.fn();
const syncPosts = jest.fn();
const createPlatformService = jest.fn();
jest.mock('@/lib/social', () => ({
  createPlatformService: (...a: unknown[]) => createPlatformService(...a),
  RedditService: class {},
}));

const findFirst = jest.fn();
const upsert = jest.fn();
const findMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformConnection: { findFirst: (...a: unknown[]) => findFirst(...a) },
    platformPost: {
      upsert: (...a: unknown[]) => upsert(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

import * as reddit from '@/app/api/social/reddit/post/route';
import * as threads from '@/app/api/social/threads/post/route';
import * as tiktok from '@/app/api/social/tiktok/post/route';
import * as youtube from '@/app/api/social/youtube/post/route';

const ROUTES = [
  {
    platform: 'reddit',
    route: reddit,
    body: { title: 'Hello', content: 'Body', subreddit: 'test' },
  },
  { platform: 'threads', route: threads, body: { content: 'Hello threads' } },
  {
    platform: 'tiktok',
    route: tiktok,
    body: { videoUrl: 'https://cdn.example.com/v.mp4', caption: 'Hi' },
  },
  {
    platform: 'youtube',
    route: youtube,
    body: { title: 'Video', videoUrl: 'https://cdn.example.com/v.mp4' },
  },
] as const;

const CONNECTION = {
  id: 'conn-1',
  userId: 'user-1',
  organizationId: 'org-1',
  accessToken: 'enc-access',
  refreshToken: 'enc-refresh',
  expiresAt: null,
  profileId: 'profile-1',
  profileName: 'name-1',
};

function req(platform: string, method: 'GET' | 'POST', body?: object) {
  return createMockNextRequest({
    method,
    url: `http://localhost/api/social/${platform}/post`,
    body,
  });
}

const originalFlag = process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;

beforeEach(() => {
  process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = 'true';
  securityCheck.mockResolvedValue({ allowed: true });
  getUserId.mockResolvedValue('user-1');
  getEffectiveOrganizationId.mockResolvedValue('org-1');
  decryptField.mockImplementation((v: string) => `plain:${v}`);
  findFirst.mockResolvedValue(CONNECTION);
  createPost.mockResolvedValue({
    success: true,
    postId: 'remote-1',
    url: 'https://example.com/p/remote-1',
  });
  createPlatformService.mockReturnValue({ createPost, syncPosts });
  upsert.mockResolvedValue({ id: 'pp-1' });
  findMany.mockResolvedValue([{ id: 'pp-1', platformId: 'remote-1' }]);
});

afterAll(() => {
  if (originalFlag === undefined) {
    delete process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;
  } else {
    process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = originalFlag;
  }
});

describe.each(ROUTES)(
  '/api/social/$platform/post',
  ({ platform, route, body }) => {
    it('POST looks up only the caller’s own active connection in their org', async () => {
      await route.POST(req(platform, 'POST', body) as never);

      expect(getEffectiveOrganizationId).toHaveBeenCalledWith('user-1');
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          platform,
          organizationId: 'org-1',
          isActive: true,
          deletedAt: null,
        },
      });
    });

    it('POST publishes with decrypted tokens and records the post on that connection', async () => {
      const res = await route.POST(req(platform, 'POST', body) as never);
      const json = await (res as Response).json();

      expect((res as Response).status).toBe(200);
      expect(createPlatformService).toHaveBeenCalledWith(
        platform,
        expect.objectContaining({
          accessToken: 'plain:enc-access',
          refreshToken: 'plain:enc-refresh',
          platformUserId: 'profile-1',
        }),
        { connectionId: 'conn-1' }
      );
      expect(upsert).toHaveBeenCalledTimes(1);
      const arg = upsert.mock.calls[0][0];
      expect(arg.where).toEqual({
        connectionId_platformId: {
          connectionId: 'conn-1',
          platformId: 'remote-1',
        },
      });
      expect(arg.create.connectionId).toBe('conn-1');
      expect(json.recorded).toBe(true);
      // usage_tracking has no Prisma model: reported, never silently dropped.
      expect(json.usage).toEqual({
        recorded: false,
        reason: expect.stringContaining('FEATURE_NOT_PROVISIONED'),
      });
    });

    it('POST returns 400 and does not publish when no connection exists', async () => {
      findFirst.mockResolvedValue(null);
      const res = await route.POST(req(platform, 'POST', body) as never);

      expect((res as Response).status).toBe(400);
      expect(createPost).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });

    it('POST returns 400 when the stored token cannot be decrypted', async () => {
      decryptField.mockReturnValue(null);
      const res = await route.POST(req(platform, 'POST', body) as never);

      expect((res as Response).status).toBe(400);
      expect(createPost).not.toHaveBeenCalled();
    });

    it('POST returns 401 before any database read when unauthenticated', async () => {
      getUserId.mockResolvedValue(null);
      const res = await route.POST(req(platform, 'POST', body) as never);

      expect((res as Response).status).toBe(401);
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('GET reads stored posts only for the caller’s connection', async () => {
      const res = await route.GET(req(platform, 'GET') as never);
      const json = await (res as Response).json();

      expect((res as Response).status).toBe(200);
      expect(findMany).toHaveBeenCalledWith({
        where: { connectionId: 'conn-1', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(json.data).toEqual([{ id: 'pp-1', platformId: 'remote-1' }]);
    });

    it('GET ?sync=true flags a failed sync instead of passing stored rows off as synced', async () => {
      syncPosts.mockResolvedValue({
        success: false,
        posts: [],
        hasMore: false,
        error: 'rate limited',
      });
      const res = await route.GET(
        createMockNextRequest({
          method: 'GET',
          url: `http://localhost/api/social/${platform}/post?sync=true`,
        }) as never
      );
      const json = await (res as Response).json();

      expect(syncPosts).toHaveBeenCalled();
      expect(json.data).toEqual([{ id: 'pp-1', platformId: 'remote-1' }]);
      expect(json.synced).toBe(false);
      expect(json.syncError).toBe('rate limited');
    });

    it('GET without sync carries no sync flag', async () => {
      const res = await route.GET(req(platform, 'GET') as never);
      const json = await (res as Response).json();
      expect(json.synced).toBeUndefined();
    });

    it('GET scopes a personal (no-org) caller to organizationId null', async () => {
      getEffectiveOrganizationId.mockResolvedValue(null);
      await route.GET(req(platform, 'GET') as never);

      expect(findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          organizationId: null,
        }),
      });
    });
  }
);

describe.each([
  { platform: 'tiktok', route: tiktok },
  { platform: 'youtube', route: youtube },
])('/api/social/$platform/post GET sync throw', ({ platform, route }) => {
  it('a thrown sync falls back to stored rows with synced:false', async () => {
    syncPosts.mockRejectedValue(new Error('network'));
    const res = await route.GET(
      createMockNextRequest({
        method: 'GET',
        url: `http://localhost/api/social/${platform}/post?sync=true`,
      }) as never
    );
    const json = await (res as Response).json();
    expect((res as Response).status).toBe(200);
    expect(json.synced).toBe(false);
    expect(json.syncError).toMatch(/sync failed/);
  });
});

describe('/api/social/youtube/post POST follow-up steps', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports a failed playlist add and thumbnail set in mediaFailed', async () => {
    global.fetch = (async (url: string) => {
      const ok = String(url).includes('thumbnail.example.com');
      return {
        ok,
        status: ok ? 200 : 403,
        text: async () => 'nope',
        arrayBuffer: async () => new ArrayBuffer(1),
      };
    }) as unknown as typeof fetch;

    const res = await youtube.POST(
      req('youtube', 'POST', {
        title: 'Video',
        videoUrl: 'https://cdn.example.com/v.mp4',
        playlistId: 'PL1',
        thumbnailUrl: 'https://thumbnail.example.com/t.jpg',
      }) as never
    );
    const json = await (res as Response).json();

    expect((res as Response).status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.mediaFailed).toEqual([
      { step: 'playlist', error: 'YouTube returned 403' },
      { step: 'thumbnail', error: 'Failed to set thumbnail' },
    ]);
  });

  it('reports an empty mediaFailed when there are no follow-up steps', async () => {
    const res = await youtube.POST(
      req('youtube', 'POST', {
        title: 'Video',
        videoUrl: 'https://cdn.example.com/v.mp4',
      }) as never
    );
    const json = await (res as Response).json();
    expect(json.mediaFailed).toEqual([]);
  });
});
