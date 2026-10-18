/**
 * P2 u07: the legacy direct social post routes (facebook, instagram,
 * linkedin, pinterest) recorded every publish in `social_posts` and
 * `usage_tracking`, neither of which has a Prisma model. They must answer
 * 503 FEATURE_NOT_PROVISIONED after auth, never publish without a record.
 */

import type { NextRequest } from 'next/server';

const mockCheck = jest.fn();
const mockGetUserId = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockCheck(...args),
    createSecureResponse: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_request: unknown, handler: () => Promise<unknown>) =>
    handler(),
}));

import * as facebook from '@/app/api/social/facebook/post/route';
import * as instagram from '@/app/api/social/instagram/post/route';
import * as linkedin from '@/app/api/social/linkedin/post/route';
import * as pinterest from '@/app/api/social/pinterest/post/route';

const ROUTES = { facebook, instagram, linkedin, pinterest };

function makeReq(method: string): NextRequest {
  return new Request('https://synthex.test/api/social/x/post', {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ message: 'hi' }) : undefined,
  }) as unknown as NextRequest;
}

const originalFlag = process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'user-A' } });
  mockGetUserId.mockResolvedValue('user-A');
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = originalFlag;
  global.fetch = originalFetch;
});

describe.each(Object.entries(ROUTES))('/api/social/%s/post', (_name, route) => {
  it('POST returns 503 FEATURE_NOT_PROVISIONED when the legacy flag is on', async () => {
    process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = 'true';
    const res = await route.POST(makeReq('POST'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('social_posts');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('POST keeps the 409 redirect to /api/social/post when the flag is off', async () => {
    delete process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS;
    const res = await route.POST(makeReq('POST'));
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toContain('/api/social/post');
  });

  it('POST returns 401 before the not-provisioned answer when unauthenticated', async () => {
    process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS = 'true';
    mockGetUserId.mockResolvedValueOnce(null);
    const res = await route.POST(makeReq('POST'));
    expect(res.status).toBe(401);
  });

  it('GET returns 503 with available:false instead of an empty post list', async () => {
    const res = await route.GET(makeReq('GET'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'FEATURE_NOT_PROVISIONED',
      available: false,
    });
    expect(body.data).toBeUndefined();
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    const res = await route.GET(makeReq('GET'));
    expect(res.status).toBe(401);
  });
});
