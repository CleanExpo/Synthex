/**
 * P2 u07: GET /api/patterns/cached read `viral_patterns`, which has no Prisma
 * model. After auth and org resolution it must answer 501, not an empty list.
 */

import type { NextRequest } from 'next/server';

const mockGetUserId = jest.fn();
const mockGetOrg = jest.fn();

jest.mock('@/lib/middleware/cache-middleware', () => ({
  cachedRoute: (handler: unknown) => handler,
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) => mockGetOrg(...args),
}));

import { GET } from '@/app/api/patterns/cached/route';

const req = () =>
  new Request(
    'https://synthex.test/api/patterns/cached?platform=instagram'
  ) as unknown as NextRequest;

beforeEach(() => jest.clearAllMocks());

describe('GET /api/patterns/cached', () => {
  it('returns 501 FEATURE_NOT_PROVISIONED naming viral_patterns', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    mockGetOrg.mockResolvedValue('org-A');
    const res = await GET(req());
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'FEATURE_NOT_PROVISIONED',
      available: false,
    });
    expect(body.reason).toContain('viral_patterns');
    expect(body.patterns).toBeUndefined();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user has no organisation', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    mockGetOrg.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
