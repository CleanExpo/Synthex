/**
 * Unit tests — SYN-598 Invite Accept API
 *
 * Covers:
 *  - POST /api/invite/accept (accept team invitation, create TeamMember, set cookie)
 *
 * Test scenarios:
 *   A) Valid invitation — upserts TeamMember, marks invitation accepted, sets cookie
 *   B) Unauthenticated — returns 401
 *   C) Missing/invalid token — returns 400
 *   D) Non-existent invitation — returns 404
 *   E) Already-accepted invitation — returns 409
 *   F) Invitation with no organisation — returns 422
 */

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  class MockCookies {
    private _store = new Map<string, { value: string; options: Record<string, unknown> }>();

    set(name: string, value: string, options: Record<string, unknown> = {}) {
      this._store.set(name, { value, options });
    }

    get(name: string) {
      return this._store.get(name);
    }

    has(name: string) {
      return this._store.has(name);
    }
  }

  class MockNextResponse {
    status: number;
    cookies: MockCookies;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
      this.cookies = new MockCookies();
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return { NextResponse: MockNextResponse, NextRequest: class extends Request {} };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockTeamInvitationFindUnique = jest.fn();
const mockTeamInvitationUpdate = jest.fn();
const mockTeamMemberUpsert = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();

// Shared prisma client mock — $transaction runs the callback against the
// same mock client (no real DB; matches the existing unit-test convention
// for this route).
const prismaMock = {
  teamInvitation: {
    findUnique: mockTeamInvitationFindUnique,
    update: mockTeamInvitationUpdate,
  },
  teamMember: { upsert: mockTeamMemberUpsert },
  user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

// RBAC seeding helper is exercised in its own test — stub here so the accept
// route's transaction does not require role/userRole models on the mock.
const mockEnsureDefaultRoles = jest.fn();
const mockGrantSystemRole = jest.fn();

jest.mock('@/lib/auth/rbac/ensure-default-roles', () => ({
  ensureDefaultRoles: (...args: unknown[]) => mockEnsureDefaultRoles(...args),
  grantSystemRole: (...args: unknown[]) => mockGrantSystemRole(...args),
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: mockGetUserId,
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-collab-001';
const ORG_ID = 'org-test-001';
const INVITATION_ID = 'inv-abc-123';
const OWNER_USER_ID = 'user-owner-001';

function makeRequest(body: object = { token: INVITATION_ID }) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/invite/accept',
    body,
  });
}

function makeInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITATION_ID,
    email: 'collab@example.com',
    status: 'pending',
    organizationId: ORG_ID,
    userId: OWNER_USER_ID,
    organization: {
      id: ORG_ID,
      name: 'Test Organisation',
      users: [{ id: OWNER_USER_ID, name: 'Phill Owner', email: 'phill@example.com' }],
    },
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockTeamMemberUpsert.mockResolvedValue({ id: 'tm-new-001' });
  mockTeamInvitationUpdate.mockResolvedValue({ id: INVITATION_ID });
  // Default: accepting user has NO org yet (normal collaborator case).
  mockUserFindUnique.mockResolvedValue({ organizationId: null });
  mockUserUpdate.mockResolvedValue({ id: USER_ID, organizationId: ORG_ID });
  mockEnsureDefaultRoles.mockResolvedValue(undefined);
  mockGrantSystemRole.mockResolvedValue(undefined);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('POST /api/invite/accept — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /api/invite/accept — validation', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
  });

  it('returns 400 when token is missing', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid token');
  });

  it('returns 400 when token is empty string', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest({ token: '' }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid token');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/invite/accept',
      body: 'not-json',
    });
    // Override .json() to simulate parse failure
    req.json = async () => { throw new Error('Unexpected token'); };

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});

// ── Invitation not found ──────────────────────────────────────────────────────

describe('POST /api/invite/accept — invitation not found', () => {
  it('returns 404 when invitation does not exist', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamInvitationFindUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Invitation not found');
  });
});

// ── Already accepted ──────────────────────────────────────────────────────────

describe('POST /api/invite/accept — already accepted', () => {
  it('returns 409 when invitation was already accepted', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamInvitationFindUnique.mockResolvedValue(makeInvitation({ status: 'accepted' }));

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('Invitation already accepted');
  });
});

// ── No organisation on invitation ─────────────────────────────────────────────

describe('POST /api/invite/accept — no organisation', () => {
  it('returns 422 when invitation has no organisationId', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamInvitationFindUnique.mockResolvedValue(
      makeInvitation({ organizationId: null })
    );

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Invitation has no organisation');
  });
});

// ── Successful acceptance ─────────────────────────────────────────────────────

describe('POST /api/invite/accept — successful acceptance', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamInvitationFindUnique.mockResolvedValue(makeInvitation());
  });

  it('upserts a TeamMember with role=collaborator', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    await POST(makeRequest() as never);

    expect(mockTeamMemberUpsert).toHaveBeenCalledTimes(1);
    const call = mockTeamMemberUpsert.mock.calls[0][0];
    expect(call.where.team_member_user_org).toEqual({
      userId: USER_ID,
      organizationId: ORG_ID,
    });
    expect(call.create.role).toBe('collaborator');
    expect(call.create.userId).toBe(USER_ID);
    expect(call.create.organizationId).toBe(ORG_ID);
    expect(call.create.invitationId).toBe(INVITATION_ID);
    expect(call.create.acceptedAt).toBeInstanceOf(Date);
    expect(call.update.role).toBe('collaborator');
    expect(call.update.acceptedAt).toBeInstanceOf(Date);
  });

  it('marks the invitation as accepted', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    await POST(makeRequest() as never);

    expect(mockTeamInvitationUpdate).toHaveBeenCalledTimes(1);
    const call = mockTeamInvitationUpdate.mock.calls[0][0];
    expect(call.where.id).toBe(INVITATION_ID);
    expect(call.data.status).toBe('accepted');
  });

  it('returns accepted=true with org details and redirect', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.accepted).toBe(true);
    expect(json.organizationId).toBe(ORG_ID);
    expect(json.organizationName).toBe('Test Organisation');
    expect(json.ownerName).toBe('Phill Owner');
    expect(json.redirectTo).toBe('/welcome');
  });

  it('sets synthex_role=collaborator cookie', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);

    const cookie = (res as any).cookies.get('synthex_role');
    expect(cookie).toBeDefined();
    expect(cookie.value).toBe('collaborator');
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.path).toBe('/');
    expect(cookie.options.sameSite).toBe('lax');
  });

  // ── P0 FIX: org FK is set so withAuth() no longer 403s the invitee ──────
  it('sets User.organizationId to the invitation org (unblocks withAuth)', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    await POST(makeRequest() as never);

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    const call = mockUserUpdate.mock.calls[0][0];
    expect(call.where.id).toBe(USER_ID);
    expect(call.data.organizationId).toBe(ORG_ID);
  });

  it('seeds default RBAC roles for the org (idempotent)', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    await POST(makeRequest() as never);

    expect(mockEnsureDefaultRoles).toHaveBeenCalledTimes(1);
    expect(mockEnsureDefaultRoles.mock.calls[0][0]).toBe(ORG_ID);
  });

  it('grants the collaborator the Viewer default role', async () => {
    const { POST } = await import('@/app/api/invite/accept/route');
    await POST(makeRequest() as never);

    expect(mockGrantSystemRole).toHaveBeenCalledTimes(1);
    const [userId, orgId, roleName] = mockGrantSystemRole.mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(orgId).toBe(ORG_ID);
    expect(roleName).toBe('Viewer');
  });
});

// ── Multi-tenancy safety ───────────────────────────────────────────────────────

describe('POST /api/invite/accept — tenancy safety', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamInvitationFindUnique.mockResolvedValue(makeInvitation());
  });

  it('returns 409 and does NOT move a user who already belongs to a different org', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-OTHER-999' });

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(409);
    // Critical: no org switch, no membership write.
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockTeamMemberUpsert).not.toHaveBeenCalled();
  });

  it('allows re-accept when the user is already in THIS org', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });

    const { POST } = await import('@/app/api/invite/accept/route');
    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(200);
    expect(mockTeamMemberUpsert).toHaveBeenCalledTimes(1);
  });
});
