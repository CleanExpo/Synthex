/**
 * Unit tests — SYN-597 Team Invite Prompt API
 *
 * Covers:
 *  - GET  /api/teams/invite-prompt (eligibility check)
 *  - POST /api/teams/invite-prompt (dismiss prompt)
 *
 * Test scenarios:
 *   A) Eligible: org age >= 45 days, dismiss count 0
 *   B) Eligible: has delivered Monthly Story (regardless of age)
 *   C) Ineligible: dismissed twice (hard cap)
 *   D) Ineligible: dismissed once, within 14-day cooldown
 *   E) Re-eligible: dismissed once, 14-day cooldown expired
 *   F) Unauthenticated — returns 401
 *   G) POST dismiss — increments dismiss count
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
const mockOrgFindUnique = jest.fn();
const mockOrgUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: mockUserFindUnique },
    organization: { findUnique: mockOrgFindUnique, update: mockOrgUpdate },
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

const DAYS_45_MS = 45 * 24 * 60 * 60 * 1000;
const DAYS_14_MS = 14 * 24 * 60 * 60 * 1000;

function makeGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/teams/invite-prompt',
  });
}

function makePostRequest() {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/teams/invite-prompt',
    body: {},
  });
}

/** Creates an org fixture with a given age in days, dismiss count, and optional dismissed-at date */
function makeOrg(opts: {
  ageDays: number;
  dismissCount: number;
  dismissedAt?: Date | null;
  hasDeliveredStory?: boolean;
}) {
  const createdAt = new Date(Date.now() - opts.ageDays * 24 * 60 * 60 * 1000);
  return {
    createdAt,
    invitePromptDismissCount: opts.dismissCount,
    invitePromptDismissedAt: opts.dismissedAt ?? null,
    monthlyStories: opts.hasDeliveredStory ? [{ id: 'story-001' }] : [],
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockOrgUpdate.mockResolvedValue({});
});

// ── GET auth guard ────────────────────────────────────────────────────────────

describe('GET /api/teams/invite-prompt — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });
});

// ── GET eligibility: shouldShow = true ────────────────────────────────────────

describe('GET /api/teams/invite-prompt — eligible', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  });

  it('returns shouldShow=true when org is 45+ days old and never dismissed', async () => {
    mockOrgFindUnique.mockResolvedValue(makeOrg({ ageDays: 50, dismissCount: 0 }));
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(true);
  });

  it('returns shouldShow=true when org has a delivered Monthly Story (even if young)', async () => {
    mockOrgFindUnique.mockResolvedValue(
      makeOrg({ ageDays: 10, dismissCount: 0, hasDeliveredStory: true })
    );
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(true);
  });

  it('returns shouldShow=true when dismissed once and 14-day cooldown expired', async () => {
    const dismissedAt = new Date(Date.now() - DAYS_14_MS - 1000); // 14 days + 1 second ago
    mockOrgFindUnique.mockResolvedValue(
      makeOrg({ ageDays: 60, dismissCount: 1, dismissedAt })
    );
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(true);
  });
});

// ── GET eligibility: shouldShow = false ───────────────────────────────────────

describe('GET /api/teams/invite-prompt — ineligible', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
  });

  it('returns shouldShow=false when dismissed twice (hard cap)', async () => {
    mockOrgFindUnique.mockResolvedValue(
      makeOrg({ ageDays: 90, dismissCount: 2, dismissedAt: new Date() })
    );
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(false);
  });

  it('returns shouldShow=false when dismissed once and within 14-day cooldown', async () => {
    const dismissedAt = new Date(Date.now() - DAYS_14_MS + 60_000); // 14 days minus 1 minute
    mockOrgFindUnique.mockResolvedValue(
      makeOrg({ ageDays: 60, dismissCount: 1, dismissedAt })
    );
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(false);
  });

  it('returns shouldShow=false when org is too young and has no delivered story', async () => {
    mockOrgFindUnique.mockResolvedValue(
      makeOrg({ ageDays: 10, dismissCount: 0, hasDeliveredStory: false })
    );
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(false);
  });

  it('returns shouldShow=false when user has no org', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(false);
  });

  it('returns shouldShow=false when org not found', async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/teams/invite-prompt/route');
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldShow).toBe(false);
  });
});

// ── POST dismiss ──────────────────────────────────────────────────────────────

describe('POST /api/teams/invite-prompt — dismiss', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/teams/invite-prompt/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no org', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { POST } = await import('@/app/api/teams/invite-prompt/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(403);
  });

  it('increments dismiss count from 0 to 1', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
    mockOrgFindUnique.mockResolvedValue({ invitePromptDismissCount: 0 });

    const { POST } = await import('@/app/api/teams/invite-prompt/route');
    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dismissed).toBe(true);

    expect(mockOrgUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockOrgUpdate.mock.calls[0][0];
    expect(updateCall.where.id).toBe(ORG_ID);
    expect(updateCall.data.invitePromptDismissCount).toBe(1);
    expect(updateCall.data.invitePromptDismissedAt).toBeInstanceOf(Date);
  });

  it('increments dismiss count from 1 to 2', async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID });
    mockOrgFindUnique.mockResolvedValue({ invitePromptDismissCount: 1 });

    const { POST } = await import('@/app/api/teams/invite-prompt/route');
    await POST(makePostRequest() as never);

    const updateCall = mockOrgUpdate.mock.calls[0][0];
    expect(updateCall.data.invitePromptDismissCount).toBe(2);
  });
});
