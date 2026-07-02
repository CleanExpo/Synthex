/**
 * Unit tests for GET /api/analytics/performance — proves real growth data
 * flows through, not hardcoded 0:
 *  - overview.growth.postsChange (consumed as Follower Growth on the page)
 *  - platforms[].growthPercent (consumed as per-platform growth on the page)
 *
 * Wiring under test: app/api/analytics/performance/route.ts
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPostFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { post: { findMany: (...a: unknown[]) => mockPostFindMany(...a) } },
  prisma: { post: { findMany: (...a: unknown[]) => mockPostFindMany(...a) } },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockSecurityCheck = jest.fn();
const mockAuditLog = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockSecurityCheck(...a),
    createSecureResponse: jest.fn(),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: { requireAuth: true } },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: (...a: unknown[]) => mockAuditLog(...a) },
}));

jest.mock('@/lib/analytics/analytics-tracker', () => ({
  analyticsTracker: {},
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/analytics/performance/route';

function request(url = 'http://localhost/api/analytics/performance?period=30d') {
  return createMockNextRequest({ url });
}

const now = new Date();
function post(platform: string, engagementParts: { likes?: number; comments?: number; shares?: number; reach?: number; impressions?: number }) {
  return {
    id: `p-${Math.random()}`,
    content: 'hello world content here long enough to slice',
    platform,
    status: 'published',
    publishedAt: now,
    createdAt: now,
    analytics: engagementParts,
    campaign: { name: 'c' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockSecurityCheck.mockResolvedValue({ allowed: true });
  mockAuditLog.mockResolvedValue(undefined);
});

describe('GET /api/analytics/performance — real growth wiring', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('surfaces non-zero overview.growth.postsChange and per-platform growthPercent from real prior-period data', async () => {
    // current period: 2 instagram posts (engagement 100 total), 1 linkedin (50)
    const currentPosts = [
      post('instagram', { likes: 40, comments: 10 }), // 50
      post('instagram', { likes: 30, comments: 20, reach: 200, impressions: 200 }), // 50
      post('linkedin', { likes: 50 }), // 50
    ];
    // previous period: 1 instagram post engagement 25, 1 linkedin 50, fewer posts total
    const previousPosts = [
      { platform: 'instagram', analytics: { likes: 25 } }, // 25
      { platform: 'linkedin', analytics: { likes: 50 } }, // 50
    ];

    // Promise.all([current, previous]) — first call returns current, second previous
    mockPostFindMany
      .mockResolvedValueOnce(currentPosts)
      .mockResolvedValueOnce(previousPosts);

    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;

    // postsChange: 3 current vs 2 previous => +50% (consumed as Follower Growth)
    expect(data.growth.postsChange).toBe(50);
    expect(data.growth.postsChange).not.toBe(0);

    const ig = data.platforms.find((p: { platform: string }) => p.platform === 'instagram');
    const li = data.platforms.find((p: { platform: string }) => p.platform === 'linkedin');

    // instagram engagement 100 vs prior 25 => +300%
    expect(ig.growthPercent).toBe(300);
    // linkedin engagement 50 vs prior 50 => 0% (honest no-change, real comparison)
    expect(li.growthPercent).toBe(0);

    // At least one platform has real non-zero growth (regression guard)
    expect(
      data.platforms.some((p: { growthPercent: number }) => p.growthPercent !== 0)
    ).toBe(true);
  });

  it('reports 100% platform growth when a platform is new (no prior-period engagement)', async () => {
    const currentPosts = [post('tiktok', { likes: 80 })];
    const previousPosts: Array<{ platform: string; analytics: unknown }> = [];

    mockPostFindMany
      .mockResolvedValueOnce(currentPosts)
      .mockResolvedValueOnce(previousPosts);

    const res = await GET(request());
    const body = await res.json();
    const tt = body.data.platforms.find(
      (p: { platform: string }) => p.platform === 'tiktok'
    );
    expect(tt.growthPercent).toBe(100);
  });
});
