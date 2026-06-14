/**
 * Revenue Projector Unit Tests — SYN-485
 *
 * Pure-additive coverage for `lib/revenue/revenue-projector.ts`, which was
 * previously untested. This module powers a customer-facing revenue-uplift
 * projection (the "$X/mo if your keywords reach top-3" widget). A regression
 * here silently mis-projects revenue, which damages trust and upsell accuracy,
 * so the math (CTR curve, revenue-per-click baseline, monthly normalisation,
 * uplift %, per-keyword breakdown + sort) is worth locking in.
 *
 * Tests assert the ACTUAL current behaviour of the module (run + verified).
 * No source is modified. Prisma is mocked following the repo convention
 * (see tests/unit/services/subscription-service.test.ts).
 */

// Mock Prisma — every code path in the projector reads from the DB.
jest.mock('@/lib/prisma', () => ({
  prisma: {
    gSCProperty: { findFirst: jest.fn() },
    keywordTarget: { findMany: jest.fn() },
    keywordRankSnapshot: { aggregate: jest.fn() },
    user: { findFirst: jest.fn() },
    revenueEntry: { aggregate: jest.fn() },
  },
}));

import { projectRankingRevenue } from '@/lib/revenue/revenue-projector';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  gSCProperty: { findFirst: jest.Mock };
  keywordTarget: { findMany: jest.Mock };
  keywordRankSnapshot: { aggregate: jest.Mock };
  user: { findFirst: jest.Mock };
  revenueEntry: { aggregate: jest.Mock };
};

const ORG = 'org_123';
const INDUSTRY_DEFAULT_RPC = 2.5;

/**
 * Configure the full happy-path mock chain. Callers override individual pieces.
 */
function setupMocks(opts: {
  gscProperty?: unknown;
  targets?: Array<{
    keyword: string;
    snapshots: Array<{
      position?: number | null;
      impressions?: number | null;
      clicks?: number | null;
    }>;
  }>;
  totalGSCClicks?: number | null;
  ownerUser?: { id: string } | null;
  totalRevenue?: number | null;
}) {
  mockPrisma.gSCProperty.findFirst.mockResolvedValue(
    opts.gscProperty === undefined ? { id: 'gsc_1', isPrimary: true } : opts.gscProperty
  );
  mockPrisma.keywordTarget.findMany.mockResolvedValue(opts.targets ?? []);
  mockPrisma.keywordRankSnapshot.aggregate.mockResolvedValue({
    _sum: { clicks: opts.totalGSCClicks ?? null },
  });
  mockPrisma.user.findFirst.mockResolvedValue(
    opts.ownerUser === undefined ? { id: 'user_1' } : opts.ownerUser
  );
  mockPrisma.revenueEntry.aggregate.mockResolvedValue({
    _sum: { amount: opts.totalRevenue ?? null },
  });
}

describe('projectRankingRevenue', () => {
  // ==========================================================================
  // EARLY-RETURN GUARDS
  // ==========================================================================
  describe('guard clauses', () => {
    it('returns a zeroed projection with hasGSC=false when no primary GSC property exists', async () => {
      setupMocks({ gscProperty: null });

      const result = await projectRankingRevenue(ORG);

      expect(result).toEqual({
        currentMonthlyRevenue: 0,
        projectedMonthlyRevenue: 0,
        upliftAmount: 0,
        upliftPercent: 0,
        revenuePerClick: INDUSTRY_DEFAULT_RPC,
        keywordBreakdown: [],
        hasGSC: false,
        hasKeywordTargets: false,
      });
      // Must short-circuit before touching keyword targets.
      expect(mockPrisma.keywordTarget.findMany).not.toHaveBeenCalled();
    });

    it('returns hasGSC=true but hasKeywordTargets=false when there are no active targets', async () => {
      setupMocks({ targets: [] });

      const result = await projectRankingRevenue(ORG);

      expect(result.hasGSC).toBe(true);
      expect(result.hasKeywordTargets).toBe(false);
      expect(result.keywordBreakdown).toEqual([]);
      expect(result.revenuePerClick).toBe(INDUSTRY_DEFAULT_RPC);
      expect(result.upliftAmount).toBe(0);
      // Should short-circuit before computing the RPC baseline.
      expect(mockPrisma.keywordRankSnapshot.aggregate).not.toHaveBeenCalled();
    });

    it('queries GSC property scoped to the org as primary', async () => {
      setupMocks({ gscProperty: null });
      await projectRankingRevenue(ORG);
      expect(mockPrisma.gSCProperty.findFirst).toHaveBeenCalledWith({
        where: { organizationId: ORG, isPrimary: true },
      });
    });

    it('only considers active keyword targets for the org', async () => {
      setupMocks({ targets: [] });
      await projectRankingRevenue(ORG);
      expect(mockPrisma.keywordTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG, isActive: true },
        })
      );
    });
  });

  // ==========================================================================
  // REVENUE-PER-CLICK BASELINE
  // ==========================================================================
  describe('revenue-per-click baseline', () => {
    it('computes RPC from real metrics when both clicks and revenue are positive', async () => {
      // 5000 revenue / 1000 clicks => $5.00 per click
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 3, impressions: 0 }] }],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);

      expect(result.revenuePerClick).toBe(5);
      // 90-day total / 3 = monthly baseline, rounded to whole cents (precise
      // Decimal division then 2dp): 5000/3 = 1666.6666… → $1666.67.
      expect(result.currentMonthlyRevenue).toBe(1666.67);
    });

    // ------------------------------------------------------------------------
    // PRECISION REGRESSION (SYN-485 follow-up)
    // ------------------------------------------------------------------------
    // The previous implementation narrowed the Prisma Decimal `_sum.amount` to a
    // JS number up front (`Number(_sum)`) and divided WITHOUT rounding, so every
    // customer-facing dollar figure carried a float tail and could drift off the
    // true cent value. This case locks in the corrected behaviour: precise
    // Decimal division then a consistent 2dp (cents) rounding on monetary output.
    //
    // For these inputs the OLD code produced:
    //   currentMonthlyRevenue    = 333333.36666666664  (float tail, not a cent value)
    //   keyword.projectedUplift  = 630.000693000693
    //   upliftAmount             = 630.000693000693
    //   projectedMonthlyRevenue  = 333963.3673596673
    // The FIX rounds these to clean cents.
    it('keeps monetary outputs precise (cents) for a large, non-divisible revenue sum', async () => {
      // 90-day revenue $1,000,000.10 over 333,333 clicks => RPC 3.0000033000033.
      // Single keyword pos 10 (CTR 0.04) -> target pos 3 (CTR 0.11),
      // weekly impressions 700 => monthly 3000 => 120 current / 330 projected
      // => 210 additional clicks.
      setupMocks({
        targets: [
          { keyword: 'precision', snapshots: [{ position: 10, impressions: 700 }] },
        ],
        totalGSCClicks: 333333,
        totalRevenue: 1000000.1,
      });

      const result = await projectRankingRevenue(ORG);

      // Monthly baseline is a true cent value, NOT 333333.36666666664.
      expect(result.currentMonthlyRevenue).toBe(333333.37);
      expect(Number.isInteger(result.currentMonthlyRevenue * 100)).toBe(true);

      // 210 * 3.0000033000033 = 630.000693… rounded to cents => $630.00.
      expect(result.keywordBreakdown[0].additionalClicks).toBe(210);
      expect(result.keywordBreakdown[0].projectedUplift).toBe(630);
      expect(result.upliftAmount).toBe(630);

      // round(333333.37 + 630) = $333963.37 (was 333963.3673596673).
      expect(result.projectedMonthlyRevenue).toBe(333963.37);
      expect(Number.isInteger(result.projectedMonthlyRevenue * 100)).toBe(true);
    });

    it('falls back to the industry default RPC when there are zero GSC clicks', async () => {
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 3, impressions: 0 }] }],
        totalGSCClicks: 0,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);
      expect(result.revenuePerClick).toBe(INDUSTRY_DEFAULT_RPC);
    });

    it('falls back to the industry default RPC when there is zero revenue', async () => {
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 3, impressions: 0 }] }],
        totalGSCClicks: 1000,
        totalRevenue: 0,
      });

      const result = await projectRankingRevenue(ORG);
      expect(result.revenuePerClick).toBe(INDUSTRY_DEFAULT_RPC);
      // No revenue => zero monthly baseline => upliftPercent stays 0 (guarded /0)
      expect(result.currentMonthlyRevenue).toBe(0);
      expect(result.upliftPercent).toBe(0);
    });

    it('treats a null clicks aggregate as zero clicks (default RPC)', async () => {
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 3, impressions: 0 }] }],
        totalGSCClicks: null,
        totalRevenue: 5000,
      });
      const result = await projectRankingRevenue(ORG);
      expect(result.revenuePerClick).toBe(INDUSTRY_DEFAULT_RPC);
    });

    it('uses default RPC and zero revenue when no owner user exists for the org', async () => {
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 3, impressions: 0 }] }],
        totalGSCClicks: 1000,
        ownerUser: null,
        totalRevenue: 5000, // ignored because owner lookup short-circuits revenue query
      });

      const result = await projectRankingRevenue(ORG);
      // No owner => revenueEntry.aggregate never called => totalRevenue stays 0
      expect(mockPrisma.revenueEntry.aggregate).not.toHaveBeenCalled();
      expect(result.revenuePerClick).toBe(INDUSTRY_DEFAULT_RPC);
      expect(result.currentMonthlyRevenue).toBe(0);
    });
  });

  // ==========================================================================
  // CTR CURVE + PER-KEYWORD PROJECTION MATH
  // ==========================================================================
  describe('per-keyword projection math', () => {
    it('projects uplift for a single keyword using the CTR curve and real RPC', async () => {
      // impressions weekly=700 => monthly = (700/7)*30 = 3000
      // position 10 => currentCTR 0.04 => 120 clicks; target pos 3 CTR 0.11 => 330 clicks
      // additional = 210; RPC = 5000/1000 = 5 => uplift = 1050
      setupMocks({
        targets: [
          { keyword: 'water damage', snapshots: [{ position: 10, impressions: 700 }] },
        ],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);

      expect(result.keywordBreakdown).toHaveLength(1);
      const kw = result.keywordBreakdown[0];
      expect(kw.keyword).toBe('water damage');
      expect(kw.currentPosition).toBe(10);
      expect(kw.targetPosition).toBe(3);
      expect(kw.currentMonthlyClicks).toBe(120);
      expect(kw.projectedMonthlyClicks).toBe(330);
      expect(kw.additionalClicks).toBe(210);
      expect(kw.projectedUplift).toBe(1050); // 210 * $5, rounded to cents

      expect(result.upliftAmount).toBe(1050);
      // Monthly baseline rounded to whole cents (5000/3 → $1666.67).
      expect(result.currentMonthlyRevenue).toBe(1666.67);
      // projected = round(1666.67 + 1050) = $2716.67
      expect(result.projectedMonthlyRevenue).toBe(2716.67);
      // 1050 / 1666.67 * 100 ≈ 62.9999 (baseline is the cents-rounded value)
      expect(result.upliftPercent).toBeCloseTo(63, 2);
    });

    it('clamps additional clicks to zero when the keyword already ranks at or above target', async () => {
      // position 1 (CTR 0.285) is already better than target pos 3 (CTR 0.11),
      // so projected < current => additionalClicks floored at 0, no uplift.
      setupMocks({
        targets: [{ keyword: 'brand term', snapshots: [{ position: 1, impressions: 700 }] }],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);
      const kw = result.keywordBreakdown[0];

      expect(kw.currentMonthlyClicks).toBe(Math.round(3000 * 0.285)); // 855
      expect(kw.projectedMonthlyClicks).toBe(330);
      expect(kw.additionalClicks).toBe(0);
      expect(kw.projectedUplift).toBe(0);
      expect(result.upliftAmount).toBe(0);
      expect(result.upliftPercent).toBe(0);
    });

    it('treats a null current position as the unranked CTR floor (0.005)', async () => {
      // currentPosition null => positionToCTR returns 0.005
      // monthly imp = 3000 => current = 15, projected = 330, additional = 315
      setupMocks({
        targets: [{ keyword: 'new term', snapshots: [{ position: null, impressions: 700 }] }],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);
      const kw = result.keywordBreakdown[0];

      expect(kw.currentPosition).toBeNull();
      expect(kw.currentMonthlyClicks).toBe(15);
      expect(kw.projectedMonthlyClicks).toBe(330);
      expect(kw.additionalClicks).toBe(315);
      expect(kw.projectedUplift).toBeCloseTo(315 * 5, 6);
    });

    it('treats a target with no snapshots as unranked (null position, zero impressions)', async () => {
      setupMocks({
        targets: [{ keyword: 'no data', snapshots: [] }],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });

      const result = await projectRankingRevenue(ORG);
      const kw = result.keywordBreakdown[0];

      expect(kw.currentPosition).toBeNull();
      // zero impressions => zero clicks on both sides => zero uplift
      expect(kw.currentMonthlyClicks).toBe(0);
      expect(kw.projectedMonthlyClicks).toBe(0);
      expect(kw.additionalClicks).toBe(0);
      expect(kw.projectedUplift).toBe(0);
    });

    it('uses the industry default RPC ($2.50) in the uplift when metrics are missing', async () => {
      // No revenue baseline => RPC default 2.5. additional clicks 210 => uplift 525.
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 10, impressions: 700 }] }],
        totalGSCClicks: 0,
        totalRevenue: 0,
      });

      const result = await projectRankingRevenue(ORG);
      expect(result.revenuePerClick).toBe(2.5);
      expect(result.keywordBreakdown[0].additionalClicks).toBe(210);
      expect(result.keywordBreakdown[0].projectedUplift).toBeCloseTo(210 * 2.5, 6);
      expect(result.upliftAmount).toBeCloseTo(525, 6);
    });
  });

  // ==========================================================================
  // AGGREGATION + SORTING ACROSS MULTIPLE KEYWORDS
  // ==========================================================================
  describe('multi-keyword aggregation', () => {
    it('sums uplift across keywords and sorts the breakdown by uplift descending', async () => {
      // low: pos 10, imp 700 => additional 210
      // high: pos 20, imp 1400 => monthly imp 6000; CTR(20)=0.015 => current 90,
      //       projected 6000*0.11=660 => additional 570
      setupMocks({
        targets: [
          { keyword: 'low', snapshots: [{ position: 10, impressions: 700 }] },
          { keyword: 'high', snapshots: [{ position: 20, impressions: 1400 }] },
        ],
        totalGSCClicks: 1000,
        totalRevenue: 5000, // RPC = 5
      });

      const result = await projectRankingRevenue(ORG);

      expect(result.keywordBreakdown.map(k => k.keyword)).toEqual(['high', 'low']);
      expect(result.keywordBreakdown[0].additionalClicks).toBe(570);
      expect(result.keywordBreakdown[1].additionalClicks).toBe(210);

      // total additional = 780 clicks * $5 = $3900
      expect(result.upliftAmount).toBe(3900);
      // projected = round(1666.67 + 3900) = $5566.67
      expect(result.projectedMonthlyRevenue).toBe(5566.67);
      // 3900 / 1666.67 * 100 ≈ 234 (baseline is the cents-rounded value)
      expect(result.upliftPercent).toBeCloseTo(234, 2);
    });

    it('reports hasGSC and hasKeywordTargets true on the full happy path', async () => {
      setupMocks({
        targets: [{ keyword: 'k', snapshots: [{ position: 10, impressions: 700 }] }],
        totalGSCClicks: 1000,
        totalRevenue: 5000,
      });
      const result = await projectRankingRevenue(ORG);
      expect(result.hasGSC).toBe(true);
      expect(result.hasKeywordTargets).toBe(true);
    });
  });
});
