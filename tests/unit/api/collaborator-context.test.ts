/**
 * Unit tests — SYN-598 Collaborator Context
 *
 * Covers:
 *  - GET /api/collaborator/context
 *
 * Validates:
 *   - 401 on missing auth
 *   - 403 when no collaborator membership found
 *   - Returns context data + shouldFireWeeklyActive=true on first visit
 *   - Returns shouldFireWeeklyActive=false when fired < 7 days ago
 *   - Updates lastActiveAt on every visit
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
const mockTeamMemberUpdate = jest.fn();
const mockAuthorityScoreFindFirst = jest.fn();
const mockMonthlyStoryFindFirst = jest.fn();
const mockPublishQueueItemFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    teamMember: {
      findFirst: mockTeamMemberFindFirst,
      update: mockTeamMemberUpdate,
    },
    authorityScore: { findFirst: mockAuthorityScoreFindFirst },
    monthlyStory: { findFirst: mockMonthlyStoryFindFirst },
    publishQueueItem: { findMany: mockPublishQueueItemFindMany },
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

const USER_ID = 'user-collab-001';
const MEMBERSHIP_ID = 'tm-001';
const ORG_ID = 'org-001';

function makeRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/collaborator/context',
    headers: { authorization: 'Bearer test-token' },
  });
}

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBERSHIP_ID,
    organizationId: ORG_ID,
    lastActiveAt: null,
    lastWeeklyActiveFiredAt: null,
    organization: {
      id: ORG_ID,
      name: 'Test Business Pty Ltd',
      users: [{ name: 'Phill Owner', email: 'phill@test.com' }],
    },
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockTeamMemberUpdate.mockResolvedValue({});
  mockAuthorityScoreFindFirst.mockResolvedValue(null);
  mockMonthlyStoryFindFirst.mockResolvedValue(null);
  mockPublishQueueItemFindMany.mockResolvedValue([]);
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/collaborator/context/route');
    const req = makeRequest();
    const res = await GET(req as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when no collaborator membership found', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamMemberFindFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/collaborator/context/route');
    const req = makeRequest();
    const res = await GET(req as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('No collaborator membership found');
  });
});

// ── First visit ───────────────────────────────────────────────────────────────

describe('First visit (lastActiveAt=null, lastWeeklyActiveFiredAt=null)', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamMemberFindFirst.mockResolvedValue(makeMembership());
  });

  it('returns shouldFireWeeklyActive=true on first visit', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldFireWeeklyActive).toBe(true);
    expect(json.isFirstVisit).toBe(true);
  });

  it('returns organisation context data', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    const res = await GET(makeRequest() as never);
    const json = await res.json();
    expect(json.organizationName).toBe('Test Business Pty Ltd');
    expect(json.ownerName).toBe('Phill Owner');
    expect(json.brandIq).toBeNull();
    expect(json.latestStory).toBeNull();
    expect(json.upcomingPosts).toEqual([]);
  });

  it('updates lastActiveAt on every visit', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    await GET(makeRequest() as never);
    expect(mockTeamMemberUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockTeamMemberUpdate.mock.calls[0][0];
    expect(updateCall.where.id).toBe(MEMBERSHIP_ID);
    expect(updateCall.data.lastActiveAt).toBeInstanceOf(Date);
  });
});

// ── Return visit within 7 days ───────────────────────────────────────────────

describe('Return visit (weekly active fired < 7 days ago)', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockTeamMemberFindFirst.mockResolvedValue(
      makeMembership({
        lastActiveAt: threeDaysAgo,
        lastWeeklyActiveFiredAt: threeDaysAgo,
      })
    );
  });

  it('returns shouldFireWeeklyActive=false when fired < 7 days ago', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    const res = await GET(makeRequest() as never);
    const json = await res.json();
    expect(json.shouldFireWeeklyActive).toBe(false);
    expect(json.isFirstVisit).toBe(false);
  });

  it('still updates lastActiveAt', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    await GET(makeRequest() as never);
    expect(mockTeamMemberUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockTeamMemberUpdate.mock.calls[0][0];
    expect(updateCall.data.lastActiveAt).toBeInstanceOf(Date);
    // Should NOT update lastWeeklyActiveFiredAt since it was < 7 days ago
    expect(updateCall.data.lastWeeklyActiveFiredAt).toBeUndefined();
  });
});

// ── Return visit after 7+ days ───────────────────────────────────────────────

describe('Return visit (weekly active fired > 7 days ago)', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    mockTeamMemberFindFirst.mockResolvedValue(
      makeMembership({
        lastActiveAt: tenDaysAgo,
        lastWeeklyActiveFiredAt: tenDaysAgo,
      })
    );
  });

  it('returns shouldFireWeeklyActive=true when fired > 7 days ago', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    const res = await GET(makeRequest() as never);
    const json = await res.json();
    expect(json.shouldFireWeeklyActive).toBe(true);
  });

  it('updates both lastActiveAt and lastWeeklyActiveFiredAt', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    await GET(makeRequest() as never);
    const updateCall = mockTeamMemberUpdate.mock.calls[0][0];
    expect(updateCall.data.lastActiveAt).toBeInstanceOf(Date);
    expect(updateCall.data.lastWeeklyActiveFiredAt).toBeInstanceOf(Date);
  });
});

// ── With populated data ──────────────────────────────────────────────────────

describe('Context with authority score and upcoming posts', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockTeamMemberFindFirst.mockResolvedValue(makeMembership());
    mockAuthorityScoreFindFirst.mockResolvedValue({ score: 72 });
    mockMonthlyStoryFindFirst.mockResolvedValue({
      monthYear: '2026-03',
      storyText: 'Great month of growth.',
      totalReach: 15000,
      postsPublished: 24,
    });
    mockPublishQueueItemFindMany.mockResolvedValue([
      { id: 'pq-1', platform: 'instagram', scheduledAt: new Date(), status: 'pending' },
    ]);
  });

  it('returns brandIq, latestStory, and upcomingPosts when available', async () => {
    const { GET } = await import('@/app/api/collaborator/context/route');
    const res = await GET(makeRequest() as never);
    const json = await res.json();
    expect(json.brandIq).toBe(72);
    expect(json.latestStory).not.toBeNull();
    expect(json.latestStory.monthYear).toBe('2026-03');
    expect(json.latestStory.totalReach).toBe(15000);
    expect(json.upcomingPosts).toHaveLength(1);
    expect(json.upcomingPosts[0].platform).toBe('instagram');
  });
});
