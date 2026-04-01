/**
 * Unit tests — SYN-607 withAuth() middleware
 *
 * Covers:
 *  - 401 when no valid session cookie / Authorization header
 *  - 403 when authenticated user has no linked organisation
 *  - AuthContext.role = 'owner' when no TeamMember row exists
 *  - AuthContext.role = 'collaborator' when TeamMember row with role='collaborator'
 *  - Handler receives correct userId and clientId
 *
 * @task SYN-607
 */

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
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

const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
  },
}));

// ── jwt-utils mock ────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { createMockNextRequest } from '../../helpers/mock-request';

const USER_ID = 'user-abc-123';
const ORG_ID = 'org-xyz-456';

function makeRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/test',
    headers: { cookie: 'sb-access-token=fake-token' },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

// ── Auth guard: 401 ───────────────────────────────────────────────────────────

describe('401 — no valid session', () => {
  it('returns 401 when getUserIdFromRequestOrCookies returns null', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { withAuth } = await import('@/lib/auth/with-auth');

    const handler = jest.fn();
    const wrappedHandler = withAuth(handler);
    const res = await wrappedHandler(makeRequest() as never);

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

// ── Org check: 403 ───────────────────────────────────────────────────────────

describe('403 — authenticated but no organisation', () => {
  it('returns 403 when user has no organizationId', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: null, teamMemberships: [] });

    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn();
    const res = await withAuth(handler)(makeRequest() as never);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe('No organisation found');
  });

  it('returns 403 when user record not found', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue(null);

    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn();
    const res = await withAuth(handler)(makeRequest() as never);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Happy path: owner ─────────────────────────────────────────────────────────

describe("role='owner' — no TeamMember row", () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [], // No row → direct org creator
    });
  });

  it('calls handler with correct userId and clientId', async () => {
    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn().mockResolvedValue({ status: 200 });

    await withAuth(handler)(makeRequest() as never);

    expect(handler).toHaveBeenCalledTimes(1);
    const [, authCtx] = handler.mock.calls[0];
    expect(authCtx.userId).toBe(USER_ID);
    expect(authCtx.clientId).toBe(ORG_ID);
  });

  it("defaults role to 'owner' when no TeamMember row exists", async () => {
    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn().mockResolvedValue({ status: 200 });

    await withAuth(handler)(makeRequest() as never);

    const [, authCtx] = handler.mock.calls[0];
    expect(authCtx.role).toBe('owner');
  });
});

// ── Happy path: collaborator ──────────────────────────────────────────────────

describe("role='collaborator' — TeamMember row with role='collaborator'", () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [
        { role: 'collaborator', organizationId: ORG_ID },
      ],
    });
  });

  it("sets role to 'collaborator' when TeamMember row exists", async () => {
    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn().mockResolvedValue({ status: 200 });

    await withAuth(handler)(makeRequest() as never);

    const [, authCtx] = handler.mock.calls[0];
    expect(authCtx.role).toBe('collaborator');
    expect(authCtx.clientId).toBe(ORG_ID);
  });
});

// ── TeamMember row for a different org is ignored ────────────────────────────

describe('TeamMember org mismatch', () => {
  it("defaults to 'owner' when TeamMember row is for a different org", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [
        { role: 'collaborator', organizationId: 'org-OTHER-789' },
      ],
    });

    const { withAuth } = await import('@/lib/auth/with-auth');
    const handler = jest.fn().mockResolvedValue({ status: 200 });

    await withAuth(handler)(makeRequest() as never);

    const [, authCtx] = handler.mock.calls[0];
    expect(authCtx.role).toBe('owner');
  });
});

// ── Prisma query shape ────────────────────────────────────────────────────────

describe('Prisma query', () => {
  it('queries user by userId and selects organizationId + teamMemberships', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      teamMemberships: [],
    });

    const { withAuth } = await import('@/lib/auth/with-auth');
    await withAuth(jest.fn().mockResolvedValue({ status: 200 }))(makeRequest() as never);

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        select: expect.objectContaining({ organizationId: true }),
      })
    );
  });
});
