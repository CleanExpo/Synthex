/**
 * Regression guard for the cross-tenant Post leak in /api/platforms/metrics.
 *
 * Before the fix the route ran under PUBLIC_READ: an unauthenticated request left
 * userId undefined, the tenant filter degraded to `{}`, and prisma.post.findMany
 * returned up to 1000 posts across ALL tenants. These tests fire if that regresses:
 *  - unauthenticated  -> 401, and NO post query runs
 *  - authenticated    -> post query is scoped by campaign.userId AND deletedAt:null
 */

import type { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCheck = jest.fn();
const mockPostFindMany = jest.fn();
const mockConnFindMany = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...a: unknown[]) => mockCheck(...a) },
  DEFAULT_POLICIES: {
    PUBLIC_READ: { requireAuth: false },
    AUTHENTICATED_READ: { requireAuth: true },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findMany: (...a: unknown[]) => mockPostFindMany(...a) },
    platformConnection: {
      findMany: (...a: unknown[]) => mockConnFindMany(...a),
    },
  },
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { GET } from '@/app/api/platforms/metrics/route';

function request(): NextRequest {
  return {
    url: 'http://localhost/api/platforms/metrics?days=30',
    method: 'GET',
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('/api/platforms/metrics — tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnFindMany.mockResolvedValue([]);
    mockPostFindMany.mockResolvedValue([]);
  });

  it('returns 401 and runs NO post query when unauthenticated', async () => {
    mockCheck.mockResolvedValue({ allowed: false, context: {} });

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockPostFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when allowed but no userId is resolved', async () => {
    mockCheck.mockResolvedValue({ allowed: true, context: {} });

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockPostFindMany).not.toHaveBeenCalled();
  });

  it('scopes the post query to the caller and excludes soft-deleted rows', async () => {
    mockCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-42' },
    });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mockPostFindMany).toHaveBeenCalledTimes(1);
    const where = (mockPostFindMany.mock.calls[0][0] as { where: any }).where;
    expect(where.campaign).toEqual({ userId: 'user-42' });
    expect(where.deletedAt).toBeNull();
  });
});
