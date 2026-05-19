/**
 * Unit tests — SYN-553 Monthly Story
 *
 * Covers:
 *  - POST /api/internal/generate-monthly-story (CRON_SECRET auth, org iteration)
 *  - POST /api/internal/deliver-monthly-story  (delivery timing, quality gate, email)
 *  - GET  /api/monthly-story/latest            (auth, unread story fetch)
 *  - POST /api/monthly-story/[id]/dismiss      (auth, org scope, dismissal)
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
const mockOrgFindMany = jest.fn();
const mockStoryFindUnique = jest.fn();
const mockStoryFindFirst = jest.fn();
const mockStoryFindMany = jest.fn();
const mockStoryCreate = jest.fn();
const mockStoryUpdate = jest.fn();
const mockStoryConfigUpsert = jest.fn();
const mockStoryConfigUpdate = jest.fn();
const mockQueueItemFindMany = jest.fn();
const mockQualityReviewCreate = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    organization: { findMany: (...a: unknown[]) => mockOrgFindMany(...a) },
    monthlyStory: {
      findUnique: (...a: unknown[]) => mockStoryFindUnique(...a),
      findFirst: (...a: unknown[]) => mockStoryFindFirst(...a),
      findMany: (...a: unknown[]) => mockStoryFindMany(...a),
      create: (...a: unknown[]) => mockStoryCreate(...a),
      update: (...a: unknown[]) => mockStoryUpdate(...a),
    },
    storyConfig: {
      upsert: (...a: unknown[]) => mockStoryConfigUpsert(...a),
      update: (...a: unknown[]) => mockStoryConfigUpdate(...a),
    },
    storyQualityReview: {
      create: (...a: unknown[]) => mockQualityReviewCreate(...a),
    },
    publishQueueItem: {
      findMany: (...a: unknown[]) => mockQueueItemFindMany(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

// ── Email mock ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/email/monthly-story-email', () => ({
  sendMonthlyStoryEmail: jest.fn(),
}));

import { sendMonthlyStoryEmail } from '@/lib/email/monthly-story-email';
const mockSendEmail = sendMonthlyStoryEmail as jest.Mock;

// ── Story generator mock ──────────────────────────────────────────────────────
// Mock the isolated story-generator service so tests don't require Anthropic SDK.

jest.mock('@/lib/ai/story-generator', () => ({
  generateMonthlyNarrative: jest
    .fn()
    .mockResolvedValue('Great month for the business!'),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/generate-monthly-story
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/internal/generate-monthly-story', () => {
  const CRON_SECRET = 'test-secret-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    const { POST } =
      await import('@/app/api/internal/generate-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/generate-monthly-story',
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token is wrong', async () => {
    const { POST } =
      await import('@/app/api/internal/generate-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/generate-monthly-story',
      headers: { authorization: 'Bearer definitely-wrong' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('skips orgs with no published posts in the period', async () => {
    mockOrgFindMany.mockResolvedValue([
      { id: 'org-1', name: 'Test Biz', liveModeT: 0, billingAnchorDate: null },
    ]);
    mockStoryFindUnique.mockResolvedValue(null); // no existing story
    mockQueueItemFindMany.mockResolvedValue([]); // no posts
    mockQueryRaw.mockResolvedValue([]);

    const { POST } =
      await import('@/app/api/internal/generate-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/generate-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it('generates story for org with published posts, holds for review when storiesReviewed < 3', async () => {
    mockOrgFindMany.mockResolvedValue([
      { id: 'org-1', name: 'CARSI', liveModeT: 1, billingAnchorDate: 15 },
    ]);
    mockStoryFindUnique.mockResolvedValue(null);
    mockQueueItemFindMany.mockResolvedValue([
      { id: 'pq-1', publishedAt: new Date() },
      { id: 'pq-2', publishedAt: new Date() },
    ]);
    mockQueryRaw.mockResolvedValue([]);
    mockStoryCreate.mockResolvedValue({ id: 'story-1' });
    mockStoryConfigUpsert.mockResolvedValue({
      organizationId: 'org-1',
      autoApproveFuture: false,
      storiesReviewed: 0,
    });
    mockQualityReviewCreate.mockResolvedValue({});
    mockStoryUpdate.mockResolvedValue({});

    const { POST } =
      await import('@/app/api/internal/generate-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/generate-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(1);

    // Email should be held for review
    expect(mockStoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailStatus: 'held_for_review' }),
      })
    );
  });

  it('skips org if story already exists for the month', async () => {
    mockOrgFindMany.mockResolvedValue([
      { id: 'org-1', name: 'Test', liveModeT: 0, billingAnchorDate: null },
    ]);
    mockStoryFindUnique.mockResolvedValue({ id: 'existing-story' }); // already generated

    const { POST } =
      await import('@/app/api/internal/generate-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/generate-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    const body = await res.json();
    expect(body.generated).toBe(0);
    expect(body.skipped).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/deliver-monthly-story
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/internal/deliver-monthly-story', () => {
  const CRON_SECRET = 'test-secret-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 401 when auth token is wrong', async () => {
    const { POST } =
      await import('@/app/api/internal/deliver-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/deliver-monthly-story',
      headers: { authorization: 'Bearer bad' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('skips stories where quality gate has not been passed', async () => {
    mockStoryFindMany.mockResolvedValue([
      {
        id: 'story-1',
        monthYear: '2026-02',
        storyText: 'Great month.',
        totalReach: 1000,
        postsPublished: 5,
        autonomousPosts: 3,
        minutesSaved: 110,
        emailStatus: 'held_for_review',
        organization: {
          id: 'org-1',
          name: 'Test',
          billingEmail: 'test@example.com',
          billingAnchorDate: 28,
          liveModeT: 0,
          users: [],
        },
        qualityReviews: [{ qualityScore: 3, approved: false }], // score < 4
        storyConfig: { autoApproveFuture: false, storiesReviewed: 1 },
      },
    ]);

    const { POST } =
      await import('@/app/api/internal/deliver-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/deliver-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.delivered).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('delivers email and marks story as delivered on success', async () => {
    // Use an anchor day exactly 50h from now (always in the 0–72h window)
    const fiftyHoursFromNow = new Date(Date.now() + 50 * 60 * 60 * 1000);
    const anchorDay = fiftyHoursFromNow.getUTCDate();

    mockStoryFindMany.mockResolvedValue([
      {
        id: 'story-2',
        monthYear: '2026-02',
        storyText: 'Excellent month.',
        totalReach: 5000,
        postsPublished: 10,
        autonomousPosts: 8,
        minutesSaved: 220,
        emailStatus: 'pending',
        organization: {
          id: 'org-2',
          name: 'Synthex',
          billingEmail: 'billing@synthex.social',
          billingAnchorDate: anchorDay,
          liveModeT: 1,
          users: [],
        },
        qualityReviews: [],
        storyConfig: { autoApproveFuture: true, storiesReviewed: 3 },
      },
    ]);

    mockSendEmail.mockResolvedValue({ success: true });
    mockStoryUpdate.mockResolvedValue({});
    mockStoryConfigUpdate.mockResolvedValue({});

    const { POST } =
      await import('@/app/api/internal/deliver-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/deliver-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    const body = await res.json();
    expect(body.delivered).toBe(1);
    expect(body.emailFailed).toBe(0);

    expect(mockStoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailStatus: 'sent' }),
      })
    );
  });

  it('creates dashboard card and schedules retry when email fails', async () => {
    const fiftyHoursFromNow = new Date(Date.now() + 50 * 60 * 60 * 1000);
    const anchorDay = fiftyHoursFromNow.getUTCDate();

    mockStoryFindMany.mockResolvedValue([
      {
        id: 'story-3',
        monthYear: '2026-02',
        storyText: 'Good month.',
        totalReach: 200,
        postsPublished: 2,
        autonomousPosts: 0,
        minutesSaved: 44,
        emailStatus: 'pending',
        organization: {
          id: 'org-3',
          name: 'Synthex',
          billingEmail: 'owner@synthex.social',
          billingAnchorDate: anchorDay,
          liveModeT: 0,
          users: [],
        },
        qualityReviews: [],
        storyConfig: { autoApproveFuture: true, storiesReviewed: 3 },
      },
    ]);

    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'Resend API error',
    });
    mockStoryUpdate.mockResolvedValue({});

    const { POST } =
      await import('@/app/api/internal/deliver-monthly-story/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/internal/deliver-monthly-story',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    const body = await res.json();
    expect(body.emailFailed).toBe(1);
    expect(body.delivered).toBe(0);

    expect(mockStoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailStatus: 'retry',
          emailError: 'Resend API error',
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/monthly-story/latest
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/monthly-story/latest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/monthly-story/latest/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/monthly-story/latest',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns { story: null } when user has no organisation', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: null });
    const { GET } = await import('@/app/api/monthly-story/latest/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/monthly-story/latest',
    });
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.story).toBeNull();
  });

  it('returns latest unread story when available', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockStoryFindFirst.mockResolvedValue({
      id: 'story-1',
      monthYear: '2026-02',
      storyText: 'February was great.',
      totalReach: 3000,
      postsPublished: 8,
      autonomousPosts: 5,
      minutesSaved: 176,
      referralClicked: false,
      generatedAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
    });
    const { GET } = await import('@/app/api/monthly-story/latest/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/monthly-story/latest',
    });
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.story.id).toBe('story-1');
    expect(body.story.monthYear).toBe('2026-02');
  });

  it('returns { story: null } when no unread stories', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockStoryFindFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/monthly-story/latest/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/monthly-story/latest',
    });
    const res = await GET(req as any);
    const body = await res.json();
    expect(body.story).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/monthly-story/[id]/dismiss
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/monthly-story/[id]/dismiss', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/monthly-story/[id]/dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/monthly-story/story-1/dismiss',
    });
    const res = await POST(req as any, {
      params: Promise.resolve({ id: 'story-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when story not found', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockStoryFindUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/monthly-story/[id]/dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/monthly-story/no-such/dismiss',
    });
    const res = await POST(req as any, {
      params: Promise.resolve({ id: 'no-such' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when story belongs to different org', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockStoryFindUnique.mockResolvedValue({
      organizationId: 'org-2', // different org
      dismissedAt: null,
    });
    const { POST } = await import('@/app/api/monthly-story/[id]/dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/monthly-story/story-x/dismiss',
    });
    const res = await POST(req as any, {
      params: Promise.resolve({ id: 'story-x' }),
    });
    expect(res.status).toBe(403);
  });

  it('sets dismissedAt and returns success', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
    mockStoryFindUnique.mockResolvedValue({
      organizationId: 'org-1',
      dismissedAt: null,
    });
    mockStoryUpdate.mockResolvedValue({});
    const { POST } = await import('@/app/api/monthly-story/[id]/dismiss/route');
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/monthly-story/story-1/dismiss',
    });
    const res = await POST(req as any, {
      params: Promise.resolve({ id: 'story-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockStoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dismissedAt: expect.any(Date) }),
      })
    );
  });
});
