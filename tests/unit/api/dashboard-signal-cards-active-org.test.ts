/**
 * Unit tests proving the dashboard-home signal-card routes resolve the
 * EFFECTIVE organisation (the active brand for a multi-business owner) via
 * getEffectiveOrganizationId(userId), not the user's home `organizationId`.
 *
 * Before the fix, all three routes queried `prisma.user.organizationId`
 * directly, so a multi-business owner who switched brand saw the WRONG
 * brand's Brand IQ / Content Intelligence / Authority Score on the landing
 * surface (stale on brand switch — the SYN-908 class).
 *
 * Routes covered:
 *   - GET /api/dashboard/brand-iq
 *   - GET /api/dashboard/content-intelligence
 *   - GET /api/dashboard/authority-score
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Mocks (declared before route imports) ───────────────────────────────────

const mockGetUserId = jest.fn();
const mockGetEffectiveOrgId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrgId(...args),
}));

// Prisma mock — only the calls each route makes on its short-circuit path.
const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockBrandDnaFindUnique = jest.fn();
const mockTrendInsightFindMany = jest.fn();
const mockContentProfileFindUnique = jest.fn();
const mockContentTrackingFindMany = jest.fn();
const mockAuthorityScoreFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => {
  const prisma = {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
    brandDNA: { findUnique: (...a: unknown[]) => mockBrandDnaFindUnique(...a) },
    trendInsight: {
      findMany: (...a: unknown[]) => mockTrendInsightFindMany(...a),
    },
    contentPerformanceProfile: {
      findUnique: (...a: unknown[]) => mockContentProfileFindUnique(...a),
    },
    contentImprovementTracking: {
      findMany: (...a: unknown[]) => mockContentTrackingFindMany(...a),
    },
    authorityScore: {
      findFirst: (...a: unknown[]) => mockAuthorityScoreFindFirst(...a),
    },
  };
  return { __esModule: true, prisma, default: prisma };
});

// Quiet the logger.
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import { GET as brandIqGET } from '@/app/api/dashboard/brand-iq/route';
import { GET as contentIntelGET } from '@/app/api/dashboard/content-intelligence/route';
import { GET as authorityGET } from '@/app/api/dashboard/authority-score/route';

const USER_ID = 'user-owner-1';
const HOME_ORG = 'org-home-aaa';
const ACTIVE_BRAND = 'org-active-brand-bbb';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  // Multi-business owner: effective org is the ACTIVE brand, not the home org.
  mockGetEffectiveOrgId.mockResolvedValue(ACTIVE_BRAND);
  // If a route ever reads user.organizationId directly, it would get the WRONG
  // (home) org — these tests fail if the regression returns.
  mockUserFindUnique.mockResolvedValue({ organizationId: HOME_ORG });
});

describe('dashboard signal-card routes — effective-org scoping', () => {
  describe('GET /api/dashboard/brand-iq', () => {
    it('queries the active brand, never the home org', async () => {
      mockOrgFindUnique.mockResolvedValue({ firstWinDetected: false });
      mockBrandDnaFindUnique.mockResolvedValue(null);
      mockTrendInsightFindMany.mockResolvedValue([]);

      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/brand-iq',
      });
      const res = await brandIqGET(req as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetEffectiveOrgId).toHaveBeenCalledWith(USER_ID);

      // Every org-scoped query used the ACTIVE brand.
      expect(mockOrgFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ACTIVE_BRAND } })
      );
      expect(mockBrandDnaFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ACTIVE_BRAND },
        })
      );
      expect(mockTrendInsightFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ACTIVE_BRAND },
        })
      );
    });

    it('returns 403 when there is no effective org', async () => {
      mockGetEffectiveOrgId.mockResolvedValue(null);
      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/brand-iq',
      });
      const res = await brandIqGET(req as never);
      expect(res.status).toBe(403);
      expect(mockOrgFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/dashboard/content-intelligence', () => {
    it('queries the active brand, never the home org', async () => {
      mockContentProfileFindUnique.mockResolvedValue(null);
      mockContentTrackingFindMany.mockResolvedValue([]);

      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/content-intelligence',
      });
      const res = await contentIntelGET(req as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetEffectiveOrgId).toHaveBeenCalledWith(USER_ID);
      expect(mockContentProfileFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ACTIVE_BRAND },
        })
      );
      expect(mockContentTrackingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ACTIVE_BRAND },
        })
      );
    });

    it('returns the empty payload (200) when there is no effective org', async () => {
      mockGetEffectiveOrgId.mockResolvedValue(null);
      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/content-intelligence',
      });
      const res = await contentIntelGET(req as never);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.hasData).toBe(false);
      expect(mockContentProfileFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/dashboard/authority-score', () => {
    it('reads the cached score for the active brand, never the home org', async () => {
      mockAuthorityScoreFindFirst.mockResolvedValue({
        score: 72,
        eeAtBreakdown: {},
        signalsVersion: 'v1',
        computedAt: new Date(),
      });

      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/authority-score',
      });
      const res = await authorityGET(req as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetEffectiveOrgId).toHaveBeenCalledWith(USER_ID);
      expect(mockAuthorityScoreFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ACTIVE_BRAND }),
        })
      );
    });

    it('returns 403 when there is no effective org', async () => {
      mockGetEffectiveOrgId.mockResolvedValue(null);
      const req = createMockNextRequest({
        url: 'http://localhost:3000/api/dashboard/authority-score',
      });
      const res = await authorityGET(req as never);
      expect(res.status).toBe(403);
      expect(mockAuthorityScoreFindFirst).not.toHaveBeenCalled();
    });
  });
});
