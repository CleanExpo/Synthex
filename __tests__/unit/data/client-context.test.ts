/**
 * Unit tests — lib/data/client-context.ts
 * SYN-687
 */

// jest.mock is hoisted to the top of the file by Babel/ts-jest.
// We must define the mock factory inline — no references to outer-scope variables.
jest.mock('@/lib/prisma', () => {
  const mockCalendarPost = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  };
  const mockGBPReview = {
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockAuthorityScore = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockSeasonalSignal = {
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockOrganization = {
    findUnique: jest.fn(),
  };
  const mockGEOAnalysis = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockOnboardingProgress = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockClientHealthScore = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const mockAIWeeklyDigest = {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  const mockNotification = {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };

  const prisma = {
    calendarPost: mockCalendarPost,
    gBPReview: mockGBPReview,
    authorityScore: mockAuthorityScore,
    seasonalSignal: mockSeasonalSignal,
    organization: mockOrganization,
    gEOAnalysis: mockGEOAnalysis,
    onboardingProgress: mockOnboardingProgress,
    clientHealthScore: mockClientHealthScore,
    aIWeeklyDigest: mockAIWeeklyDigest,
    notification: mockNotification,
  };

  return {
    prisma,
    __esModule: true,
    default: prisma,
  };
});

import {
  getClientContext,
  toPromptContext,
  getClientDetail,
} from '@/lib/data/client-context';
import { prisma } from '@/lib/prisma';
import type { ClientContext } from '@/lib/data/types';

// Cast mocked prisma to access jest mock methods
const mp = prisma as unknown as Record<string, Record<string, jest.Mock>>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIENT_ID = 'org_test_123';

function buildDefaultMocks() {
  // org profile — called many times (once per domain that needs user IDs)
  mp.organization.findUnique.mockResolvedValue({
    name: 'Test Plumbing Co',
    industry: 'plumbing-hvac',
    users: [{ id: 'user_1' }],
  });

  // posts
  mp.calendarPost.findMany.mockResolvedValue([
    {
      status: 'published',
      platforms: ['instagram', 'facebook'],
      analytics: null,
      title: 'Winter plumbing tips',
      createdAt: new Date(),
    },
    {
      status: 'draft',
      platforms: ['instagram'],
      analytics: { engagementRate: 3.5 },
      title: 'Summer maintenance guide',
      createdAt: new Date(),
    },
  ]);
  mp.calendarPost.count.mockResolvedValue(5);
  mp.calendarPost.findFirst.mockResolvedValue(null);

  // reviews
  mp.gBPReview.findMany.mockResolvedValue([
    { rating: 5, replyText: 'Thanks!', createdAt: new Date() },
    { rating: 4, replyText: null, createdAt: new Date() },
    { rating: 3, replyText: 'Appreciated', createdAt: new Date() },
  ]);
  mp.gBPReview.count.mockResolvedValue(1);

  // authority — first call = latest, second call = previous
  mp.authorityScore.findFirst.mockResolvedValue({
    score: 72,
    computedAt: new Date('2026-04-01'),
  });

  // seasonal
  mp.seasonalSignal.findMany.mockResolvedValue([
    {
      opportunityLabel: 'Winter Pipe Season',
      windowStart: new Date('2026-03-01'),
      windowEnd: new Date('2026-09-30'),
    },
  ]);

  // GEO
  mp.gEOAnalysis.findFirst.mockResolvedValue({ overallScore: 68 });

  // journey
  mp.onboardingProgress.findFirst.mockResolvedValue({
    currentStage: 'complete',
    createdAt: new Date('2026-01-01'),
    completedAt: new Date('2026-01-15'),
  });

  // health
  mp.clientHealthScore.findFirst.mockResolvedValue({
    overallScore: 80,
    weekStart: new Date('2026-03-30'),
  });

  // digest
  mp.aIWeeklyDigest.count.mockResolvedValue(4);
  mp.aIWeeklyDigest.findFirst.mockResolvedValue({
    emailSentAt: new Date('2026-04-01'),
  });

  // notifications
  mp.notification.count.mockResolvedValue(3);
  mp.notification.findFirst.mockResolvedValue({
    createdAt: new Date('2026-04-04'),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getClientContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildDefaultMocks();
  });

  it('returns a complete ClientContext with available=true for all domains when all queries succeed', async () => {
    const ctx = await getClientContext(CLIENT_ID);

    expect(ctx.clientId).toBe(CLIENT_ID);
    expect(ctx.profile.organizationName).toBe('Test Plumbing Co');
    expect(ctx.profile.industry).toBe('plumbing-hvac');

    expect(ctx.posts.available).toBe(true);
    expect(ctx.calendar.available).toBe(true);
    expect(ctx.reviews.available).toBe(true);
    expect(ctx.authority.available).toBe(true);
    expect(ctx.seasonal.available).toBe(true);
    expect(ctx.geo.available).toBe(true);
    expect(ctx.journey.available).toBe(true);
    expect(ctx.health.available).toBe(true);
    expect(ctx.digest.available).toBe(true);
    expect(ctx.notifications.available).toBe(true);

    expect(ctx.retrievedAt).toBeTruthy();
  });

  it('correctly summarises posts data', async () => {
    const ctx = await getClientContext(CLIENT_ID);

    if (!ctx.posts.available) throw new Error('posts should be available');

    expect(ctx.posts.totalPosts).toBe(2); // 2 items from findMany mock
    expect(ctx.posts.publishedVsDraft.published).toBe(1);
    expect(ctx.posts.publishedVsDraft.draft).toBe(1);
    expect(ctx.posts.platformBreakdown).toMatchObject({
      instagram: 2,
      facebook: 1,
    });
  });

  it('degrades gracefully when the reviews query rejects', async () => {
    mp.gBPReview.findMany.mockRejectedValue(new Error('DB connection lost'));

    const ctx = await getClientContext(CLIENT_ID);

    expect(ctx.reviews.available).toBe(false);
    if (!ctx.reviews.available) {
      expect(ctx.reviews.reason).toBe('error');
      expect(ctx.reviews.error).toContain('DB connection lost');
    }

    // Other domains should still be available
    expect(ctx.posts.available).toBe(true);
    expect(ctx.authority.available).toBe(true);
  });

  it('marks domain as timeout when query rejects with a timeout error', async () => {
    mp.clientHealthScore.findFirst.mockRejectedValue(new Error('timeout'));

    const ctx = await getClientContext(CLIENT_ID);

    expect(ctx.health.available).toBe(false);
    if (!ctx.health.available) {
      expect(ctx.health.reason).toBe('timeout');
    }
  });

  it('correctly computes authority trend as "up" when score increased', async () => {
    mp.authorityScore.findFirst
      .mockResolvedValueOnce({ score: 75, computedAt: new Date('2026-04-01') })
      .mockResolvedValueOnce({ score: 68, computedAt: new Date('2026-03-25') });

    const ctx = await getClientContext(CLIENT_ID);

    if (!ctx.authority.available)
      throw new Error('authority should be available');
    expect(ctx.authority.latestScore).toBe(75);
    expect(ctx.authority.trend).toBe('up');
  });

  it('returns trend=null when there is only one authority score', async () => {
    mp.authorityScore.findFirst
      .mockResolvedValueOnce({ score: 60, computedAt: new Date('2026-04-01') })
      .mockResolvedValueOnce(null);

    const ctx = await getClientContext(CLIENT_ID);

    if (!ctx.authority.available)
      throw new Error('authority should be available');
    expect(ctx.authority.trend).toBeNull();
  });

  it('includes retrievedAt as a valid ISO timestamp', async () => {
    const ctx = await getClientContext(CLIENT_ID);
    expect(() => new Date(ctx.retrievedAt)).not.toThrow();
    expect(new Date(ctx.retrievedAt).toISOString()).toBe(ctx.retrievedAt);
  });
});

describe('toPromptContext', () => {
  const baseCtx: ClientContext = {
    clientId: 'org_abc',
    profile: {
      clientId: 'org_abc',
      organizationName: 'Acme Plumbing',
      industry: 'plumbing-hvac',
      postsSummary: {
        available: true,
        totalPosts: 50,
        last30Days: 10,
        last7Days: 3,
        topPerformingTopic: 'pipes',
        avgEngagementRate: 4.2,
        publishedVsDraft: { published: 45, draft: 5 },
        platformBreakdown: { instagram: 30, facebook: 20 },
      },
    },
    posts: {
      available: true,
      totalPosts: 50,
      last30Days: 10,
      last7Days: 3,
      topPerformingTopic: 'pipes',
      avgEngagementRate: 4.2,
      publishedVsDraft: { published: 45, draft: 5 },
      platformBreakdown: { instagram: 30, facebook: 20 },
    },
    calendar: {
      available: true,
      upcomingPosts: 5,
      overdueCount: 1,
      nextScheduledDate: '2026-04-10T09:00:00.000Z',
    },
    reviews: {
      available: true,
      totalReviews: 120,
      avgRating: 4.6,
      last30Days: 8,
      responseRate: 0.9,
    },
    authority: { available: true, latestScore: 72, trend: 'up' },
    seasonal: {
      available: true,
      activeSignals: 2,
      upcomingEvents: ['Winter Pipe Season'],
    },
    geo: { available: true, score: 68, band: 'good' },
    journey: {
      available: true,
      currentStage: 'complete',
      daysSinceOnboarding: 80,
    },
    health: {
      available: true,
      overallScore: 80,
      weekStart: '2026-03-30T00:00:00.000Z',
    },
    digest: {
      available: true,
      lastDelivered: '2026-04-01T00:00:00.000Z',
      totalDelivered: 12,
    },
    notifications: {
      available: true,
      unreadCount: 2,
      lastNotificationAt: '2026-04-04T08:00:00.000Z',
    },
    retrievedAt: '2026-04-05T00:00:00.000Z',
  };

  it('stays within the default token budget (2000 tokens ≈ 8000 chars)', () => {
    const output = toPromptContext(baseCtx);
    expect(output.length).toBeLessThanOrEqual(8000);
  });

  it('respects a tight custom token budget', () => {
    const tightBudget = 50; // 50 × 4 chars = 200 chars
    const output = toPromptContext(baseCtx, tightBudget);
    expect(output.length).toBeLessThanOrEqual(tightBudget * 4);
  });

  it('includes client name and industry in output', () => {
    const output = toPromptContext(baseCtx);
    expect(output).toContain('Acme Plumbing');
    expect(output).toContain('plumbing-hvac');
  });

  it('includes posts and reviews sections when budget allows', () => {
    const output = toPromptContext(baseCtx);
    expect(output).toContain('POSTS:');
    expect(output).toContain('REVIEWS:');
  });

  it('gracefully handles unavailable domains without throwing', () => {
    const ctxWithUnavailable: ClientContext = {
      ...baseCtx,
      reviews: { available: false, reason: 'error', error: 'DB timeout' },
      health: { available: false, reason: 'timeout' },
    };

    expect(() => toPromptContext(ctxWithUnavailable)).not.toThrow();
    const output = toPromptContext(ctxWithUnavailable);
    // reviews section should be absent since it is not available
    expect(output).not.toContain('REVIEWS:');
    // posts section should still be present
    expect(output).toContain('POSTS:');
  });
});

describe('getClientDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mp.calendarPost.findMany.mockResolvedValue([
      { id: 'post_1', status: 'published', title: 'Post 1' },
      { id: 'post_2', status: 'draft', title: 'Post 2' },
    ]);
    mp.calendarPost.count.mockResolvedValue(2);
  });

  it('returns paginated results for the posts domain', async () => {
    const result = await getClientDetail(CLIENT_ID, 'posts', {
      page: 1,
      pageSize: 10,
    });

    expect(result.domain).toBe('posts');
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('defaults page=1 and pageSize=20 when options are omitted', async () => {
    const result = await getClientDetail(CLIENT_ID, 'posts');

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
