/**
 * tests/unit/api/campaign-brand-scope-audit9.test.ts
 *
 * Brand-scope regression suite (variant-b audit #9).
 *
 * BUG CLASS: routes that read the tenant-owned `Campaign` model (which carries
 * `organizationId`) scoped by `userId` ALONE leak campaign data across every
 * brand a multi-business owner owns — not just the brand they are currently
 * acting as (their active organisation).
 *
 * These tests drive the REAL handlers and lock that, when the caller's active
 * brand differs from their home org, the Campaign read targets the ACTIVE brand
 * (via `getEffectiveOrganizationId`) while preserving the null-org fallback for
 * legacy / unassigned campaigns.
 *
 * Routes covered:
 *   - app/api/content/bulk/route.ts        (POST, operation: 'create')
 *   - app/api/personas/[id]/optimize/route (GET)
 *
 * `app/api/user/export/route.ts` is intentionally NOT scoped — it is a GDPR
 * Art. 20 full-account data export and must return ALL the user's data across
 * every brand — so it has no brand-scope test here by design.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  post: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
  persona: {
    findFirst: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

// Both routes import from the subpath '@/lib/multi-business/business-scope'.
const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrg(...args),
}));

jest.mock('@/lib/cache/invalidate-stats', () => ({
  invalidatePostStats: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { POST as bulkPOST } from '@/app/api/content/bulk/route';
import { GET as optimizeGET } from '@/app/api/personas/[id]/optimize/route';

const USER = 'owner-1';
const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333';

function bulkRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    body,
    url: 'http://localhost:3000/api/content/bulk',
  }) as never;
}

function optimizeRequest() {
  return createMockNextRequest({
    url: 'http://localhost:3000/api/personas/persona-1/optimize',
  }) as never;
}

const optimizeParams = { params: Promise.resolve({ id: 'persona-1' }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER);
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId: USER },
  });
  // Active brand differs from the user's home org for every test.
  mockGetEffectiveOrg.mockResolvedValue(ACTIVE_BRAND);
});

// ---------------------------------------------------------------------------
// content/bulk — create operation
// ---------------------------------------------------------------------------

describe('content/bulk create — Campaign read is brand-scoped', () => {
  it('scopes the campaign ownership check to the ACTIVE brand (not all brands)', async () => {
    mockPrisma.campaign.findMany.mockResolvedValue([
      { id: CAMPAIGN_ID, platform: 'linkedin' },
    ]);
    mockPrisma.post.createMany.mockResolvedValue({ count: 1 });

    const res = await bulkPOST(
      bulkRequest({
        operation: 'create',
        posts: [{ content: 'hello world', campaignId: CAMPAIGN_ID }],
      })
    );

    expect(res.status).toBe(200);
    expect(mockGetEffectiveOrg).toHaveBeenCalledWith(USER);

    // The where clause must filter by the ACTIVE brand, not the home org, and
    // must keep the null-org fallback.
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { organizationId: null },
        { organizationId: ACTIVE_BRAND },
      ])
    );
    // Must NOT silently widen to the home org.
    expect(JSON.stringify(where)).not.toContain(HOME_ORG);
  });

  it('preserves the null-org fallback when there is no active brand', async () => {
    mockGetEffectiveOrg.mockResolvedValueOnce(null);
    mockPrisma.campaign.findMany.mockResolvedValue([
      { id: CAMPAIGN_ID, platform: 'linkedin' },
    ]);
    mockPrisma.post.createMany.mockResolvedValue({ count: 1 });

    const res = await bulkPOST(
      bulkRequest({
        operation: 'create',
        posts: [{ content: 'hello world', campaignId: CAMPAIGN_ID }],
      })
    );

    expect(res.status).toBe(200);
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    // No active brand: only the null-org branch remains.
    expect(where.OR).toEqual([{ organizationId: null }]);
  });

  it('403s when a requested campaign is outside the active brand (read returns fewer rows)', async () => {
    // Two campaigns requested, but only one is visible in the active brand.
    mockPrisma.campaign.findMany.mockResolvedValue([
      { id: CAMPAIGN_ID, platform: 'linkedin' },
    ]);

    const OTHER_CAMPAIGN = '44444444-4444-4444-8444-444444444444';
    const res = await bulkPOST(
      bulkRequest({
        operation: 'create',
        posts: [
          { content: 'a', campaignId: CAMPAIGN_ID },
          { content: 'b', campaignId: OTHER_CAMPAIGN },
        ],
      })
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.post.createMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// personas/[id]/optimize — GET
// ---------------------------------------------------------------------------

describe('personas/[id]/optimize GET — Campaign read is brand-scoped', () => {
  beforeEach(() => {
    mockPrisma.persona.findFirst.mockResolvedValue({
      id: 'persona-1',
      name: 'Test',
      tone: 'professional',
      style: 'formal',
      vocabulary: 'standard',
      emotion: 'neutral',
      accuracy: 80,
      lastTrained: new Date(),
    });
    mockPrisma.post.findMany.mockResolvedValue([]);
  });

  it('scopes the campaign lookup to the ACTIVE brand (not all brands)', async () => {
    mockPrisma.campaign.findMany.mockResolvedValue([{ id: CAMPAIGN_ID }]);

    const res = await optimizeGET(optimizeRequest(), optimizeParams);

    expect(res.status).toBe(200);
    expect(mockGetEffectiveOrg).toHaveBeenCalledWith(USER);

    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { organizationId: null },
        { organizationId: ACTIVE_BRAND },
      ])
    );
    expect(JSON.stringify(where)).not.toContain(HOME_ORG);
  });

  it('preserves the null-org fallback when there is no active brand', async () => {
    mockGetEffectiveOrg.mockResolvedValueOnce(null);
    mockPrisma.campaign.findMany.mockResolvedValue([{ id: CAMPAIGN_ID }]);

    const res = await optimizeGET(optimizeRequest(), optimizeParams);

    expect(res.status).toBe(200);
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(where.OR).toEqual([{ organizationId: null }]);
  });
});
