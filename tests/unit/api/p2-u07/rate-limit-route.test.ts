/**
 * P2 u07: /api/rate-limit ported from the noop stub to Prisma.
 * GET reads only the caller's own user + subscription; POST verifies the
 * target user and audit-logs the reset; PATCH is NOT_PROVISIONED because
 * users.rate_limit_override does not exist.
 */

import type { NextRequest } from 'next/server';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
};
const mockGetUserId = jest.fn();
const mockGetStatus = jest.fn();
const mockReset = jest.fn();

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma, default: mockPrisma }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));
jest.mock('@/lib/rate-limit', () => ({
  getRateLimitStatus: (...args: unknown[]) => mockGetStatus(...args),
  resetRateLimits: (...args: unknown[]) => mockReset(...args),
}));

import { GET, POST, PATCH } from '@/app/api/rate-limit/route';

const ADMIN_KEY = 'test-admin-key';
const originalAdminKey = process.env.ADMIN_API_KEY;

function req(method: string, body?: unknown, admin = true): NextRequest {
  return new Request('https://synthex.test/api/rate-limit', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(admin ? { 'x-admin-key': ADMIN_KEY } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_API_KEY = ADMIN_KEY;
});

afterAll(() => {
  process.env.ADMIN_API_KEY = originalAdminKey;
});

describe('GET /api/rate-limit', () => {
  it('reads only the caller user and subscription via Prisma', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    mockGetStatus.mockResolvedValue({ remaining: 5 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@example.test' });
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'business' });

    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      select: { email: true },
    });
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
      select: { plan: true },
    });
    const body = await res.json();
    expect(body).toMatchObject({
      email: 'a@example.test',
      plan: 'business',
      customLimit: null,
      customLimitAvailable: false,
    });
  });

  it('returns 401 without a session and reads nothing', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(req('GET'));
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/rate-limit', () => {
  it('verifies the target user, resets, and writes an audit log via Prisma', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-B',
      email: 'b@example.test',
    });
    const res = await POST(req('POST', { userId: 'user-B' }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-B' },
      select: { id: true, email: true },
    });
    expect(mockReset).toHaveBeenCalledWith('user-B');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'rate_limit_reset',
        resourceId: 'user-B',
      }),
    });
  });

  it('writes the audit row before resetting, with a key fingerprint', async () => {
    const order: string[] = [];
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-B',
      email: 'b@example.test',
    });
    mockPrisma.auditLog.create.mockImplementation(async () => {
      order.push('audit');
    });
    mockReset.mockImplementation(async () => {
      order.push('reset');
    });
    const res = await POST(req('POST', { userId: 'user-B' }));
    expect(res.status).toBe(200);
    expect(order).toEqual(['audit', 'reset']);
    const details = mockPrisma.auditLog.create.mock.calls[0][0].data.details;
    expect(details.adminId).toBeUndefined();
    expect(details.adminKeyFingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(details)).not.toContain(ADMIN_KEY);
  });

  it('does not reset when the audit row cannot be written', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-B',
      email: 'b@example.test',
    });
    mockPrisma.auditLog.create.mockRejectedValue(new Error('audit down'));
    const res = await POST(req('POST', { userId: 'user-B' }));
    expect(res.status).toBe(500);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(req('POST', { userId: 'missing' }));
    expect(res.status).toBe(404);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('returns 401 without the admin key', async () => {
    const res = await POST(req('POST', { userId: 'user-B' }, false));
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/rate-limit', () => {
  it('returns 503 FEATURE_NOT_PROVISIONED and writes nothing', async () => {
    const res = await PATCH(req('PATCH', { userId: 'user-B', limit: 500 }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('rate_limit_override');
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns 401 without the admin key', async () => {
    const res = await PATCH(req('PATCH', { userId: 'u', limit: 1 }, false));
    expect(res.status).toBe(401);
  });
});
