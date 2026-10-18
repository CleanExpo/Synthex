/**
 * P2 u07: /api/optimize/auto-schedule
 * - POST is NOT_PROVISIONED (no scheduled_posts table) → 503 after auth.
 * - PUT is ported to the caller's own users.user_settings JSON via Prisma.
 */

import type { NextRequest } from 'next/server';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
const mockCheck = jest.fn();

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma, default: mockPrisma }));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockCheck(...args),
    createSecureResponse: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));
jest.mock('@/lib/ml/posting-time-predictor', () => ({
  postingTimePredictor: { getOptimalTimesMultiPlatform: jest.fn() },
}));

import { POST, PUT } from '@/app/api/optimize/auto-schedule/route';

function req(method: string, body: unknown): NextRequest {
  return new Request('https://synthex.test/api/optimize/auto-schedule', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'user-A' } });
});

describe('POST /api/optimize/auto-schedule', () => {
  it('returns 503 FEATURE_NOT_PROVISIONED naming scheduled_posts', async () => {
    const res = await POST(
      req('POST', { postIds: ['p1'], platforms: ['instagram'] })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('scheduled_posts');
  });

  it('returns 403 when the security check fails', async () => {
    mockCheck.mockResolvedValue({ allowed: false, error: 'nope' });
    const res = await POST(
      req('POST', { postIds: ['p1'], platforms: ['instagram'] })
    );
    expect(res.status).toBe(403);
  });

  it('still validates input (400) before answering', async () => {
    const res = await POST(req('POST', { postIds: [] }));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/optimize/auto-schedule', () => {
  it('merges settings into the caller user row only', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      settings: { theme: 'dark' },
    });
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PUT(
      req('PUT', { enabled: true, defaultTimezone: 'UTC' })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      select: { settings: true },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      data: {
        settings: {
          theme: 'dark',
          autoSchedule: { enabled: true, defaultTimezone: 'UTC' },
        },
      },
    });
  });

  it('returns 404 when the user row is missing and writes nothing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await PUT(req('PUT', { enabled: false }));
    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
