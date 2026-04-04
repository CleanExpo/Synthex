/**
 * Unit tests — SYN-552 Progressive Live Mode
 *
 * Covers:
 *  - GET  /api/calendar/live-mode-readiness
 *  - POST /api/calendar/live-mode-activate
 *  - POST /api/calendar/nudge-dismiss
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

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

  return { ...actual, NextResponse: MockNextResponse };
});

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
const mockGetUserId = getUserIdFromRequestOrCookies as jest.Mock;

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockOrgUpdate = jest.fn();
const mockPublishQueueCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
    publishQueueItem: {
      count: (...args: unknown[]) => mockPublishQueueCount(...args),
    },
  },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Default org fixture ───────────────────────────────────────────────────────

const DEFAULT_ORG = {
  calendarMode: 'shadow',
  liveModeT: 0,
  shadowModeApprovalRate: 0,
  consecutiveThresholdPasses: 3,
  perpetualReviewer: false,
  nudgeDismissedAt: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calendar/live-mode-readiness
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/calendar/live-mode-readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no organisation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 404 when organisation record not found', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue(null);
    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(404);
  });

  it('returns readiness state with computed approvalRate', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue(DEFAULT_ORG);
    // approved=8, rejected=2 → 80%
    mockPublishQueueCount
      .mockResolvedValueOnce(8) // approved
      .mockResolvedValueOnce(2); // rejected

    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.shadowPostsReviewed).toBe(10);
    expect(body.approvalRate).toBe(80);
    expect(body.consecutivePasses).toBe(3);
    expect(body.readyToActivate).toBe(false);
  });

  it('sets readyToActivate=true when consecutivePasses >= 5', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue({
      ...DEFAULT_ORG,
      consecutiveThresholdPasses: 5,
    });
    mockPublishQueueCount.mockResolvedValue(0);

    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.readyToActivate).toBe(true);
  });

  it('returns approvalRate=0 when no posts reviewed yet', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue(DEFAULT_ORG);
    mockPublishQueueCount.mockResolvedValue(0);

    const { GET } =
      await import('@/app/api/calendar/live-mode-readiness/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/calendar/live-mode-readiness',
    });
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.approvalRate).toBe(0);
    expect(body.shadowPostsReviewed).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/live-mode-activate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/calendar/live-mode-activate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } =
      await import('@/app/api/calendar/live-mode-activate/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/live-mode-activate',
      body: { tier: 1, confirmed: true },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid (tier missing)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    const { POST } =
      await import('@/app/api/calendar/live-mode-activate/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/live-mode-activate',
      body: { confirmed: true }, // missing tier
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when confirmed is false', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    const { POST } =
      await import('@/app/api/calendar/live-mode-activate/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/live-mode-activate',
      body: { tier: 1, confirmed: false },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('activates tier 1 and returns updated state', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue({
      liveModeT: 0,
      calendarMode: 'shadow',
    });
    const activatedAt = new Date();
    mockOrgUpdate.mockResolvedValue({
      liveModeT: 1,
      calendarMode: 'live',
      liveModeActivatedAt: activatedAt,
    });

    const { POST } =
      await import('@/app/api/calendar/live-mode-activate/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/live-mode-activate',
      body: { tier: 1, confirmed: true },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.liveModeT).toBe(1);
    expect(body.calendarMode).toBe('live');
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ liveModeT: 1, calendarMode: 'live' }),
      })
    );
  });

  it('is idempotent — returns current state when already tier 1', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue({ liveModeT: 1, calendarMode: 'live' });

    const { POST } =
      await import('@/app/api/calendar/live-mode-activate/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/live-mode-activate',
      body: { tier: 1, confirmed: true },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe('Already in live mode');
    expect(mockOrgUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/nudge-dismiss
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/calendar/nudge-dismiss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/calendar/nudge-dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/nudge-dismiss',
      body: { threshold: 30 },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid threshold value', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    const { POST } = await import('@/app/api/calendar/nudge-dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/nudge-dismiss',
      body: { threshold: 99 }, // not 30 | 45 | 60
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('records the dismiss timestamp for threshold 30', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue({
      nudgeDismissedAt: null,
      liveModeT: 0,
    });
    mockOrgUpdate.mockResolvedValue({});

    const { POST } = await import('@/app/api/calendar/nudge-dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/nudge-dismiss',
      body: { threshold: 30 },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.threshold).toBe(30);
    expect(body.perpetualReviewer).toBe(false);

    // Ensure the update was called with the right key
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nudgeDismissedAt: expect.objectContaining({
            '30': expect.any(String),
          }),
        }),
      })
    );
  });

  it('sets perpetualReviewer=true when all 3 thresholds dismissed', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    // 30 and 45 already dismissed; now dismissing 60
    mockOrgFindUnique.mockResolvedValue({
      nudgeDismissedAt: {
        '30': '2026-01-01T00:00:00Z',
        '45': '2026-01-08T00:00:00Z',
      },
      liveModeT: 0,
    });
    mockOrgUpdate.mockResolvedValue({});

    const { POST } = await import('@/app/api/calendar/nudge-dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/nudge-dismiss',
      body: { threshold: 60 },
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.perpetualReviewer).toBe(true);
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ perpetualReviewer: true }),
      })
    );
  });

  it('suppresses when org is already in live mode (liveModeT >= 1)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockOrgFindUnique.mockResolvedValue({
      nudgeDismissedAt: null,
      liveModeT: 1,
    });

    const { POST } = await import('@/app/api/calendar/nudge-dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/calendar/nudge-dismiss',
      body: { threshold: 30 },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suppressed).toBe(true);
    expect(mockOrgUpdate).not.toHaveBeenCalled();
  });
});
