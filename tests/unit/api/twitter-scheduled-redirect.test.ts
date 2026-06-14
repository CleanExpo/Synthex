/**
 * P1 / syn-p1-retire-dead-scheduler — route-level proof.
 *
 * The Twitter direct route (`/api/social/twitter/post`) is the live, un-gated
 * entry point that used to write scheduled tweets into the dead `scheduled_posts`
 * Supabase table (drained by a BullMQ worker that is never booted → silent loss).
 *
 * This test drives the real POST handler with a `scheduledTime` and asserts:
 *   - it routes the post through `scheduleViaPost` (the working Post + cron path),
 *   - it returns the scheduled Post id with status 'scheduled',
 *   - it NEVER inserts into the `scheduled_posts` table again.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

// NOTE: jest.config sets resetMocks:true, so mock *implementations* are wiped
// before every test — they must be (re)applied in beforeEach, not in the factory.

// -- Capture every Supabase table touched so we can assert scheduled_posts is gone.
const touchedTables: string[] = [];
const supabaseInsert = jest.fn();
const supabaseFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: supabaseFrom }),
}));

// -- Rate-limit wrapper: just run the handler.
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

// -- Auth.
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
  unauthorizedResponse: () => ({ status: 401 }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// -- The Twitter service should NOT be asked to publish for a scheduled post.
const scheduleTweet = jest.fn();
const postTweet = jest.fn();
const postThread = jest.fn();
const validateTweet = jest.fn();
jest.mock('@/lib/social/twitter-service', () => ({
  twitterService: {
    scheduleTweet: (...a: unknown[]) => scheduleTweet(...a),
    postTweet: (...a: unknown[]) => postTweet(...a),
    postThread: (...a: unknown[]) => postThread(...a),
    uploadMedia: jest.fn(),
    validateTweet: (...a: unknown[]) => validateTweet(...a),
  },
}));

// -- The working scheduler entry point.
const scheduleViaPost = jest.fn();
jest.mock('@/lib/social/schedule-via-post', () => ({
  scheduleViaPost: (...args: unknown[]) => scheduleViaPost(...args),
}));

import { POST } from '@/app/api/social/twitter/post/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/social/twitter/post',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  touchedTables.length = 0;

  supabaseInsert.mockResolvedValue({ data: null, error: null });
  supabaseFrom.mockImplementation((table: string) => {
    touchedTables.push(table);
    return {
      select: () => ({
        eq: () => ({ single: async () => ({ data: { plan: 'pro' } }) }),
      }),
      insert: supabaseInsert,
    };
  });
  securityCheck.mockResolvedValue({ allowed: true });
  getUserId.mockResolvedValue('user-1');
  validateTweet.mockReturnValue({ valid: true });
  scheduleViaPost.mockResolvedValue({
    id: 'post-abc',
    platform: 'twitter',
    scheduledAt: '2030-01-01T12:00:00.000Z',
    status: 'scheduled',
  });
});

describe('POST /api/social/twitter/post — scheduled tweet lands in the working scheduler', () => {
  it('routes a scheduled tweet through scheduleViaPost and returns the Post id', async () => {
    const res = await POST(req({ text: 'hi', scheduledTime: '2030-01-01T12:00:00.000Z' }));
    const body = await (res as Response).json();

    expect(scheduleViaPost).toHaveBeenCalledTimes(1);
    expect(scheduleViaPost).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        platform: 'twitter',
        content: 'hi',
        scheduledTime: new Date('2030-01-01T12:00:00.000Z'),
      })
    );

    expect(body).toEqual({
      success: true,
      scheduled: true,
      data: {
        id: 'post-abc',
        scheduledTime: '2030-01-01T12:00:00.000Z',
        status: 'scheduled',
      },
    });
  });

  it('NEVER writes to the dead scheduled_posts table for a scheduled tweet', async () => {
    await POST(req({ text: 'hi', scheduledTime: '2030-01-01T12:00:00.000Z' }));

    expect(touchedTables).not.toContain('scheduled_posts');
    // And the legacy no-op stub publisher is not invoked either.
    expect(scheduleTweet).not.toHaveBeenCalled();
  });

  it('does not schedule (no Post created) for an immediate tweet', async () => {
    postTweet.mockResolvedValue({ id: 'tweet-1' });
    await POST(req({ text: 'now' }));
    expect(scheduleViaPost).not.toHaveBeenCalled();
    expect(postTweet).toHaveBeenCalledTimes(1);
  });
});
