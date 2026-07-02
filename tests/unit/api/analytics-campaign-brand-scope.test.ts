/**
 * Brand-scope coverage for the three analytics reads that resolve the caller's
 * Campaign rows (audit #8): /api/analytics/export, /insights, /realtime.
 *
 * BUG CLASS: each route scoped the tenant-owned Campaign model (which carries a
 * nullable organizationId) by userId ALONE — so a brand-switched owner read
 * campaign analytics across ALL their brands.
 *
 * Locks, per route:
 *   - the Campaign query is scoped to the caller's ACTIVE brand
 *     (getEffectiveOrganizationId), not userId alone; and
 *   - legacy/no-org campaigns (organizationId == null) are still included so the
 *     no-org fallback is preserved.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

// ── Shared mocks ────────────────────────────────────────────────────────────
const mockPrisma = {
  post: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  campaign: { findMany: jest.fn() },
  analyticsEvent: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Unauthorized' }) }),
}));

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockCheck(...args),
    createSecureResponse: (data: unknown, status: number) => ({
      status,
      json: async () => data,
    }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) => mockGetEffectiveOrg(...args),
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// jspdf is lazy-imported by the export route; stub so the bundle never loads it.
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('jspdf-autotable', () => ({ __esModule: true, default: jest.fn() }));

import { GET as exportGET } from '@/app/api/analytics/export/route';
import { GET as insightsGET } from '@/app/api/analytics/insights/route';
import { GET as realtimeGET } from '@/app/api/analytics/realtime/route';

const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';
const USER = 'user-1';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated owner whose ACTIVE brand differs from their home org.
  mockGetUserId.mockResolvedValue(USER);
  mockCheck.mockResolvedValue({
    allowed: true,
    context: { userId: USER },
  });
  mockGetEffectiveOrg.mockResolvedValue(ACTIVE_BRAND);

  mockPrisma.campaign.findMany.mockResolvedValue([]);
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockPrisma.post.count.mockResolvedValue(0);
  mockPrisma.post.groupBy.mockResolvedValue([]);
  mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
  mockPrisma.analyticsEvent.count.mockResolvedValue(0);
  mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);
});

/** Extract the OR-array of organizationId conditions from a campaign where. */
function orgConditions(where: Record<string, unknown>): unknown[] {
  return (where.OR as unknown[]) ?? [];
}

describe('GET /api/analytics/export — Campaign brand-scope', () => {
  function req() {
    return createMockNextRequest({
      url: 'http://localhost/api/analytics/export?format=json&period=30d',
    });
  }

  it('scopes the campaign read to the active brand (not userId alone) and keeps no-org rows', async () => {
    await exportGET(req());

    expect(mockGetEffectiveOrg).toHaveBeenCalledWith(USER);
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(orgConditions(where)).toEqual(
      expect.arrayContaining([
        { organizationId: ACTIVE_BRAND },
        { organizationId: null },
      ])
    );
  });

  it('scopes the nested post→campaign read to the active brand too', async () => {
    await exportGET(req());

    const campaignWhere = mockPrisma.post.findMany.mock.calls[0][0].where.campaign;
    expect(campaignWhere.userId).toBe(USER);
    expect(orgConditions(campaignWhere)).toEqual(
      expect.arrayContaining([
        { organizationId: ACTIVE_BRAND },
        { organizationId: null },
      ])
    );
  });

  it('preserves the no-org fallback: null active org still includes null-org campaigns', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    await exportGET(req());

    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(orgConditions(where)).toEqual(
      expect.arrayContaining([
        { organizationId: null }, // active-org branch resolves to null
      ])
    );
  });

  it('returns 401 and never reads campaigns when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await exportGET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.campaign.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/analytics/insights — Campaign brand-scope', () => {
  function req() {
    return createMockNextRequest({
      url: 'http://localhost/api/analytics/insights?period=30d',
    });
  }

  it('scopes the campaign read to the active brand (not userId alone) and keeps no-org rows', async () => {
    await insightsGET(req());

    expect(mockGetEffectiveOrg).toHaveBeenCalledWith(USER);
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(orgConditions(where)).toEqual([
      { organizationId: ACTIVE_BRAND },
      { organizationId: null },
    ]);
  });

  it('preserves the no-org fallback when there is no active org context', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    await insightsGET(req());

    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(orgConditions(where)).toEqual([
      { organizationId: null },
      { organizationId: null },
    ]);
  });

  it('returns 401 and never reads campaigns when unauthenticated', async () => {
    mockCheck.mockResolvedValue({ allowed: false, error: 'Unauthorized', context: {} });

    const res = await insightsGET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.campaign.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/analytics/realtime — Campaign brand-scope', () => {
  function req() {
    return createMockNextRequest({
      url: 'http://localhost/api/analytics/realtime',
    });
  }

  it('scopes the campaign read to the active brand (not userId alone) and keeps no-org rows', async () => {
    await realtimeGET(req());

    expect(mockGetEffectiveOrg).toHaveBeenCalledWith(USER);
    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER);
    expect(orgConditions(where)).toEqual([
      { organizationId: ACTIVE_BRAND },
      { organizationId: null },
    ]);
  });

  it('preserves the no-org fallback when there is no active org context', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    await realtimeGET(req());

    const where = mockPrisma.campaign.findMany.mock.calls[0][0].where;
    expect(orgConditions(where)).toEqual([
      { organizationId: null },
      { organizationId: null },
    ]);
  });

  it('returns 401 and never reads campaigns when unauthenticated', async () => {
    mockCheck.mockResolvedValue({ allowed: false, error: 'Unauthorized', context: {} });

    const res = await realtimeGET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.campaign.findMany).not.toHaveBeenCalled();
  });
});
