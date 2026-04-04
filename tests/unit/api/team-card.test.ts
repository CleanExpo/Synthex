/**
 * Unit tests — SYN-599 Team Card API
 *
 * Covers:
 *  - GET /api/teams/team-card (authenticated owner dashboard card)
 *
 * Test scenarios:
 *   A) Authenticated owner with team members — returns non-owner accepted members
 *   B) Authenticated user with no org — returns empty array
 *   C) Unauthenticated — returns 401
 *   D) Excludes owner-role members from the response
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
const mockTeamMemberFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    teamMember: { findMany: mockTeamMemberFindMany },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: mockGetUserId,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-owner-001';
const ORG_ID = 'org-test-001';

function makeRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/teams/team-card',
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('GET /api/teams/team-card — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/teams/team-card/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });
});

// ── No organisation ───────────────────────────────────────────────────────────

describe('GET /api/teams/team-card — no organisation', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
  });

  it('returns empty members array when user has no org', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { GET } = await import('@/app/api/teams/team-card/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual([]);
  });

  it('returns empty members array when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/teams/team-card/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual([]);
  });
});

// ── Authenticated owner with members ──────────────────────────────────────────

describe('GET /api/teams/team-card — returns team members', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  });

  it('returns accepted non-owner members for the dashboard card', async () => {
    const now = new Date('2026-04-01T10:00:00Z');
    mockTeamMemberFindMany.mockResolvedValue([
      {
        id: 'tm-001',
        role: 'collaborator',
        lastActiveAt: now,
        user: { name: 'Alice Smith', email: 'alice@example.com' },
      },
      {
        id: 'tm-002',
        role: 'collaborator',
        lastActiveAt: null,
        user: { name: null, email: 'bob@example.com' },
      },
    ]);

    const { GET } = await import('@/app/api/teams/team-card/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.members).toHaveLength(2);
    expect(json.members[0]).toEqual({
      id: 'tm-001',
      name: 'Alice Smith',
      email: 'alice@example.com',
      role: 'collaborator',
      lastActiveAt: now.toISOString(),
    });
    expect(json.members[1]).toEqual({
      id: 'tm-002',
      name: null,
      email: 'bob@example.com',
      role: 'collaborator',
      lastActiveAt: null,
    });
  });

  it('queries with role: { not: "owner" } and acceptedAt: { not: null }', async () => {
    mockTeamMemberFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/teams/team-card/route');
    await GET(makeRequest() as never);

    expect(mockTeamMemberFindMany).toHaveBeenCalledTimes(1);
    const queryArg = mockTeamMemberFindMany.mock.calls[0][0];
    expect(queryArg.where.organizationId).toBe(ORG_ID);
    expect(queryArg.where.role).toEqual({ not: 'owner' });
    expect(queryArg.where.acceptedAt).toEqual({ not: null });
  });

  it('returns empty array when no team members exist', async () => {
    mockTeamMemberFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/teams/team-card/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual([]);
  });
});
