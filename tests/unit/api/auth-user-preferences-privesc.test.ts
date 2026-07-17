/**
 * SYN-1105 P0 — self-serve privilege escalation via preferences.role.
 *
 * PUT /api/auth/user previously used `.passthrough()` on the preferences schema
 * and wrote the request preferences verbatim, so a user could persist
 * `preferences.role = 'superadmin'` — which lib/billing/plan-access.ts trusts
 * for full-access/admin gates. This test executes the REAL PUT handler and
 * proves `role` can never be set from the request, while a legitimately-stored
 * role is preserved server-side.
 */

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => {
  const { NextResponse } = require('next/server');
  return {
    getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
    isOwnerEmail: () => false,
    unauthorizedResponse: () =>
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
});

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockAuditCreate = jest.fn();
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  };
  return { __esModule: true, prisma: prismaMock, default: prismaMock };
});

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { PUT } from '@/app/api/auth/user/route';

function putRequest(body: object) {
  return createMockNextRequest({
    method: 'PUT',
    url: 'http://localhost/api/auth/user',
    body,
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user_1');
  mockAuditCreate.mockResolvedValue({});
  // The route's update returns the selected fields — echo the written prefs.
  mockUserUpdate.mockImplementation(async ({ data }: { data: any }) => ({
    id: 'user_1',
    email: 'user@x.com',
    name: data.name ?? 'User',
    avatar: null,
    emailVerified: null,
    preferences: data.preferences ?? {},
  }));
});

describe('PUT /api/auth/user — role cannot be self-granted (SYN-1105 P0)', () => {
  it('does NOT persist role from the request body', async () => {
    mockUserFindUnique.mockResolvedValue({ preferences: {} });

    const res = await PUT(putRequest({ preferences: { role: 'superadmin' } }));

    expect(res.status).toBe(200);
    const written = mockUserUpdate.mock.calls[0][0].data.preferences as Record<
      string,
      unknown
    >;
    expect(written).not.toHaveProperty('role');

    const json = await res.json();
    expect(json.user.preferences).not.toHaveProperty('role');
  });

  it('strips role even when mixed with valid preference keys', async () => {
    mockUserFindUnique.mockResolvedValue({ preferences: {} });

    const res = await PUT(
      putRequest({ preferences: { role: 'admin', theme: 'dark' } })
    );

    expect(res.status).toBe(200);
    const written = mockUserUpdate.mock.calls[0][0].data.preferences as Record<
      string,
      unknown
    >;
    expect(written).not.toHaveProperty('role');
    expect(written.theme).toBe('dark');
  });

  it('preserves a legitimately-stored role (server-owned, not from request)', async () => {
    mockUserFindUnique.mockResolvedValue({
      preferences: { role: 'admin', theme: 'dark' },
    });

    const res = await PUT(
      putRequest({ preferences: { role: 'superadmin', theme: 'light' } })
    );

    expect(res.status).toBe(200);
    const written = mockUserUpdate.mock.calls[0][0].data.preferences as Record<
      string,
      unknown
    >;
    // Role stays what the server had — the request cannot escalate it.
    expect(written.role).toBe('admin');
    expect(written.theme).toBe('light');
  });
});
