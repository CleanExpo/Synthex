/**
 * Unit tests — SYN-599 Collaborator Pageview
 *
 * Covers:
 *  - POST /api/collaborator/pageview
 *
 * Validates:
 *   - 401 on missing auth
 *   - 400 for missing pagePath
 *   - Records page view for active collaborator
 *   - Returns recorded=false for non-collaborator (no-op)
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

const mockTeamMemberFindFirst = jest.fn();
const mockTeamMemberPageViewCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    teamMember: { findFirst: mockTeamMemberFindFirst },
    teamMemberPageView: { create: mockTeamMemberPageViewCreate },
  },
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

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-collab-002';
const MEMBERSHIP_ID = 'tm-002';
const ORG_ID = 'org-002';

function makeRequest(body?: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/collaborator/pageview',
    headers: { authorization: 'Bearer test-token' },
    body,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockTeamMemberPageViewCreate.mockResolvedValue({ id: 'pv-001' });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/collaborator/pageview/route');
    const req = makeRequest({ pagePath: '/dashboard' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('Body validation', () => {
  it('returns 400 for missing pagePath', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const { POST } = await import('@/app/api/collaborator/pageview/route');
    const req = makeRequest({});
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
  });

  it('returns 400 for empty pagePath', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const { POST } = await import('@/app/api/collaborator/pageview/route');
    const req = makeRequest({ pagePath: '' });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});

// ── Collaborator page view ───────────────────────────────────────────────────

describe('Records page view for collaborator', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamMemberFindFirst.mockResolvedValue({
      id: MEMBERSHIP_ID,
      organizationId: ORG_ID,
    });
  });

  it('creates a page view record and returns recorded=true', async () => {
    const { POST } = await import('@/app/api/collaborator/pageview/route');
    const req = makeRequest({ pagePath: '/dashboard/advisor' });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recorded).toBe(true);
    expect(mockTeamMemberPageViewCreate).toHaveBeenCalledTimes(1);
    const createCall = mockTeamMemberPageViewCreate.mock.calls[0][0];
    expect(createCall.data.teamMemberId).toBe(MEMBERSHIP_ID);
    expect(createCall.data.organizationId).toBe(ORG_ID);
    expect(createCall.data.pagePath).toBe('/dashboard/advisor');
  });
});

// ── Non-collaborator (no-op) ─────────────────────────────────────────────────

describe('Non-collaborator — silent no-op', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamMemberFindFirst.mockResolvedValue(null);
  });

  it('returns recorded=false without creating a page view', async () => {
    const { POST } = await import('@/app/api/collaborator/pageview/route');
    const req = makeRequest({ pagePath: '/dashboard' });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recorded).toBe(false);
    expect(mockTeamMemberPageViewCreate).not.toHaveBeenCalled();
  });
});
