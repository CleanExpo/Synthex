/**
 * SYN-1105 P0 (sibling path) — self-serve privilege escalation via a team
 * member's own preferences.role.
 *
 * PATCH /api/teams/members/[memberId] previously accepted
 * `preferences: z.record(z.string(), z.unknown())` and merged it verbatim onto
 * the stored preferences, so a member could PATCH their OWN member id with
 * `{ preferences: { role: 'superadmin' } }` — which lib/billing/plan-access.ts
 * (isFullAccessUser) and lib/admin/verify-admin.ts trust. This test executes the
 * REAL PATCH handler and proves `role` can never be set from the request, while
 * a legitimately-stored role is preserved server-side.
 */

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = require('next/server');
  return {
    DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {}, AUTHENTICATED_READ: {} },
    APISecurityChecker: {
      check: async () => ({ allowed: true }),
      createSecureResponse: (data: unknown, status = 200) =>
        NextResponse.json(data, { status }),
    },
  };
});

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn(async () => ({})) },
}));

jest.mock('@/lib/api/response-optimizer', () => {
  const { NextResponse } = require('next/server');
  return {
    ResponseOptimizer: {
      createResponse: (data: unknown, opts?: { status?: number }) =>
        NextResponse.json(data, { status: opts?.status ?? 200 }),
      createErrorResponse: (message: string, status: number) =>
        NextResponse.json({ error: message }, { status }),
    },
  };
});

const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserRoleFindMany = jest.fn();
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    userRole: { findMany: (...a: unknown[]) => mockUserRoleFindMany(...a) },
  };
  return { __esModule: true, default: prismaMock, prisma: prismaMock };
});

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { PATCH } from '@/app/api/teams/members/[memberId]/route';

const MEMBER_ID = 'user_self';

function patchRequest(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: `http://localhost/api/teams/members/${MEMBER_ID}`,
    body,
  }) as unknown as import('next/server').NextRequest;
}

const paramsArg = { params: Promise.resolve({ memberId: MEMBER_ID }) };

function setupMember(storedPreferences: Record<string, unknown>) {
  // Requesting user's org lookup.
  mockUserFindUnique.mockResolvedValue({ organizationId: 'org_1' });
  // Member (same org) lookup — carries the stored preferences.
  mockUserFindFirst.mockResolvedValue({
    id: MEMBER_ID,
    organizationId: 'org_1',
    email: 'self@x.com',
    preferences: storedPreferences,
  });
  // Admin lookup (unused on the self-update path) — no admin roles.
  mockUserRoleFindMany.mockResolvedValue([]);
  // Echo the written preferences back like the route's select does.
  mockUserUpdate.mockImplementation(async ({ data }: { data: any }) => ({
    id: MEMBER_ID,
    email: 'self@x.com',
    name: data.name ?? 'Self',
    avatar: null,
    preferences: data.preferences ?? {},
    updatedAt: new Date(),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  // Requesting user is updating their OWN member id (self-update path).
  mockGetUserId.mockResolvedValue(MEMBER_ID);
});

describe('PATCH /api/teams/members/[memberId] — role cannot be self-granted (SYN-1105 P0)', () => {
  it('does NOT persist role when a member PATCHes their own preferences', async () => {
    setupMember({});

    const res = await PATCH(
      patchRequest({ preferences: { role: 'superadmin' } }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockUserUpdate.mock.calls[0][0].data.preferences as Record<
      string,
      unknown
    >;
    expect(written).not.toHaveProperty('role');

    const json = await res.json();
    expect(json.member.preferences).not.toHaveProperty('role');
  });

  it('strips role even when mixed with valid preference keys', async () => {
    setupMember({});

    const res = await PATCH(
      patchRequest({ preferences: { role: 'admin', theme: 'dark' } }),
      paramsArg
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
    setupMember({ role: 'admin', theme: 'dark' });

    const res = await PATCH(
      patchRequest({ preferences: { role: 'superadmin', theme: 'light' } }),
      paramsArg
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
