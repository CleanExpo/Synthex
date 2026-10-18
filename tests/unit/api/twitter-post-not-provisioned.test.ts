/**
 * P2 / retire the noop-client stub — direct X/Twitter route.
 *
 * Immediate tweets go out via a shared app account and were logged to a
 * Supabase `social_posts` table that has no Prisma model. The route now says
 * so (503 FEATURE_NOT_PROVISIONED) instead of publishing and losing the record.
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
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const postTweet = jest.fn();
const postThread = jest.fn();
const uploadMedia = jest.fn();
jest.mock('@/lib/social/twitter-service', () => ({
  twitterService: {
    postTweet: (...a: unknown[]) => postTweet(...a),
    postThread: (...a: unknown[]) => postThread(...a),
    uploadMedia: (...a: unknown[]) => uploadMedia(...a),
    validateTweet: () => ({ valid: true }),
  },
}));

jest.mock('@/lib/social/schedule-via-post', () => ({
  scheduleViaPost: jest.fn(),
}));

import { GET, POST } from '@/app/api/social/twitter/post/route';

function req(method: 'GET' | 'POST', body?: object) {
  return createMockNextRequest({
    method,
    url: 'http://localhost/api/social/twitter/post',
    body,
  });
}

const originalFlag = process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;

beforeEach(() => {
  process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = 'true';
  securityCheck.mockResolvedValue({ allowed: true });
  getUserId.mockResolvedValue('user-1');
});

afterAll(() => {
  if (originalFlag === undefined) {
    delete process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;
  } else {
    process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = originalFlag;
  }
});

describe('/api/social/twitter/post — social_posts not provisioned', () => {
  it('POST immediate tweet returns 503 FEATURE_NOT_PROVISIONED without publishing', async () => {
    const res = await POST(
      req('POST', { text: 'now', mediaUrls: ['https://x/a.png'] }) as never
    );
    const json = await (res as Response).json();

    expect((res as Response).status).toBe(503);
    expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(json.message).toContain('social_posts');
    expect(postTweet).not.toHaveBeenCalled();
    expect(postThread).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it('POST immediate thread returns 503 without publishing', async () => {
    const res = await POST(req('POST', { thread: ['a', 'b'] }) as never);

    expect((res as Response).status).toBe(503);
    expect(postThread).not.toHaveBeenCalled();
  });

  it('POST still requires auth before reporting the gap', async () => {
    getUserId.mockResolvedValue(null);
    const res = await POST(req('POST', { text: 'now' }) as never);

    expect((res as Response).status).toBe(401);
  });

  it('GET returns available:false with 503, never an empty 2xx list', async () => {
    const res = await GET(req('GET') as never);
    const json = await (res as Response).json();

    expect((res as Response).status).toBe(503);
    expect(json).toEqual({
      available: false,
      error: 'FEATURE_NOT_PROVISIONED',
      reason: expect.stringContaining('social_posts'),
    });
  });
});
