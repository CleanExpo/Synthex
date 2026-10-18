/**
 * /api/health/scaling is admin-only: GET exposes internal ops metrics and POST
 * can reset counters or set the circuit breaker, so a signed-in non-admin must
 * be refused. Exercises the real lib/admin/verify-admin.
 */

/** @jest-environment node */

import type { NextRequest } from 'next/server';

const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => {
  const prisma = {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  };
  return { __esModule: true, prisma, default: prisma };
});

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
  isOwnerEmail: () => false,
}));

import { GET, POST } from '@/app/api/health/scaling/route';

function req(method: string, body?: unknown): NextRequest {
  return new Request('https://synthex.test/api/health/scaling', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function signedIn(role?: string) {
  mockGetUserId.mockResolvedValue('user-A');
  mockUserFindUnique.mockResolvedValue({
    id: 'user-A',
    email: 'a@example.test',
    preferences: role ? { role } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/api/health/scaling admin guard', () => {
  it('GET 401s without a session', async () => {
    mockGetUserId.mockResolvedValue(null);
    expect((await GET(req('GET'))).status).toBe(401);
  });

  it('GET 403s for a signed-in non-admin', async () => {
    signedIn();
    expect((await GET(req('GET'))).status).toBe(403);
  });

  it('GET returns metrics for an admin', async () => {
    signedIn('admin');
    const res = await GET(req('GET'));
    expect([200, 207, 503]).toContain(res.status);
    expect((await res.json()).resources).toBeDefined();
  });

  it('POST 401s without a session', async () => {
    mockGetUserId.mockResolvedValue(null);
    expect((await POST(req('POST', { action: 'reset' }))).status).toBe(401);
  });

  it('POST 403s for a signed-in non-admin and changes nothing', async () => {
    signedIn();
    const res = await POST(
      req('POST', { action: 'circuit_breaker', value: 'open' })
    );
    expect(res.status).toBe(403);
    signedIn('admin');
    const metrics = await (await GET(req('GET'))).json();
    expect(metrics.config.circuitBreakerStatus).not.toBe('open');
  });

  it('POST lets an admin record an action', async () => {
    signedIn('admin');
    const res = await POST(req('POST', { action: 'reset' }));
    expect(res.status).toBe(200);
  });
});
