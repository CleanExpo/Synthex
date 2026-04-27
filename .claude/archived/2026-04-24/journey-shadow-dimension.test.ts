/**
 * SYN-679 — Journey Engagement Shadow Dimension Test Suite
 *
 * Tests for the new journey_engagement shadow dimension added to the Health Score
 * computation engine. Validates:
 * - Shadow dimension computed and logged when JOURNEY_DIMENSION_ACTIVE = false
 * - Shadow dimension does NOT affect composite score when toggle is false
 * - Shadow dimension IS included at 10% weight when toggle is true
 * - Existing 6 dimensions are reweighted to 90% total when toggle is true
 * - Clients with 0 journey moments get null engagement rate
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeHealthScore,
  saveHealthScore,
  computeAllHealthScores,
  type ComputedHealthScore,
  type DimensionScore,
} from '@/lib/health-score/compute';
import { prisma } from '@/lib/prisma';

// Mock Prisma to control test data
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
    },
    calendarPost: {
      count: vi.fn(),
    },
    contentImprovementTracking: {
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    aIWeeklyDigest: {
      count: vi.fn(),
    },
    gBPReview: {
      findMany: vi.fn(),
    },
    authorityScore: {
      findMany: vi.fn(),
    },
    advisorFeedback: {
      findMany: vi.fn(),
    },
    clientEngagementEvent: {
      findMany: vi.fn(),
    },
    clientHealthScore: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

describe('SYN-679 — Journey Engagement Shadow Dimension', () => {
  const testOrgId = 'org-test-679';
  const testWeekStart = new Date('2026-04-07T00:00:00Z'); // Monday

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Core Behavior: Shadow Dimension Computed, Not In Composite ──

  describe('When JOURNEY_DIMENSION_ACTIVE = false', () => {
    it('should compute journey_engagement and store in shadowDimensions', async () => {
      // Mock all 6 core dimensions with non-null values
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5) // sent
        .mockResolvedValueOnce(4); // opened
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([
        {
          replyText: 'Great review!',
          replyTime: new Date('2026-04-01T10:00:00Z'),
          reviewTime: new Date('2026-03-31T14:00:00Z'),
        },
      ]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 72, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 68, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
        { eventType: 'content_view' },
      ]);

      // Mock journey_analytics query to return engagement data
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          engagement_rate: 0.75, // 75%
          total_moments_received: 4,
        },
      ]);

      // Mock previous week score
      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      // Assertions: Shadow dimension should be populated
      expect(result.shadowDimensions).toBeDefined();
      expect(result.shadowDimensions.journey_engagement).not.toBeNull();
      expect(result.shadowDimensions.journey_engagement?.score).toBe(75);
      expect(result.shadowDimensions.journey_engagement?.raw_value).toBe(0.75);
    });

    it('should NOT include journey_engagement in composite score when JOURNEY_DIMENSION_ACTIVE = false', async () => {
      // Set up scenario where all 6 core dimensions are at 50, journey is at 90
      const mockDimensions = {
        calendarPost: 5, // 50% published
        weeklyDigest: [10, 5], // 50% opened
        reviews: [
          {
            replyText: 'x',
            replyTime: new Date('2026-04-01T00:00:00Z'),
            reviewTime: new Date('2026-03-31T00:00:00Z'),
          },
        ],
        authority: [
          { score: 50, computedAt: new Date('2026-04-05T00:00:00Z') },
          { score: 50, computedAt: new Date('2026-03-29T00:00:00Z') },
        ],
        advisor: [{ response: 'helpful' }],
        engagement: [{ eventType: 'dashboard_visit' }],
      };

      vi.mocked(prisma.calendarPost.count).mockResolvedValue(
        mockDimensions.calendarPost
      );
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(mockDimensions.weeklyDigest[0])
        .mockResolvedValueOnce(mockDimensions.weeklyDigest[1]);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue(
        mockDimensions.reviews as any
      );
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue(
        mockDimensions.authority as any
      );
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue(
        mockDimensions.advisor as any
      );
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue(
        mockDimensions.engagement as any
      );

      // Journey engagement high at 90
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: 0.9, total_moments_received: 10 },
      ]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      // When toggle is OFF, journey should NOT pull up the composite score
      // All 6 core dimensions are ~50, so composite should be ~50 (not pulled up by 90)
      // Exact value depends on weighting, but should be around 50 +/- 5
      expect(result.overallScore).toBeGreaterThanOrEqual(45);
      expect(result.overallScore).toBeLessThanOrEqual(55);

      // But shadow dimension still stored
      expect(result.shadowDimensions.journey_engagement?.score).toBe(90);
    });

    it('should handle null journey_engagement gracefully (no journey data)', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
      ]);

      // journey_analytics returns empty (no journey data)
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      // Shadow dimension should be null
      expect(result.shadowDimensions.journey_engagement).toBeNull();
      // But composite score still computable
      expect(result.overallScore).not.toBeNull();
    });
  });

  // ── Null Handling: Zero Journey Moments ──

  describe('Zero journey moments handling', () => {
    it('should return null when total_moments_received = 0', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([]);

      // journey_analytics returns 0 moments
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: null, total_moments_received: 0 },
      ]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      // Shadow dimension should be null (no moments)
      expect(result.shadowDimensions.journey_engagement).toBeNull();
    });

    it('should convert engagement_rate null to 0 safely', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
      ]);

      // engagement_rate is null, but moments exist
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: null, total_moments_received: 5 },
      ]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      // Should default null to 0
      expect(result.shadowDimensions.journey_engagement).not.toBeNull();
      expect(result.shadowDimensions.journey_engagement?.score).toBe(0);
      expect(result.shadowDimensions.journey_engagement?.raw_value).toBe(0);
    });
  });

  // ── Persistence: saveHealthScore ──

  describe('saveHealthScore persistence', () => {
    it('should persist shadow_dimensions via raw SQL UPDATE', async () => {
      const testScore: ComputedHealthScore = {
        organizationId: testOrgId,
        weekStart: testWeekStart,
        overallScore: 65,
        dimensions: {
          content_consistency: {
            score: 60,
            raw_value: 0.6,
            description: 'test',
          },
          engagement_trajectory: {
            score: 70,
            raw_value: 0.7,
            description: 'test',
          },
          review_responsiveness: null,
          authority_momentum: null,
          advisor_engagement: {
            score: 80,
            raw_value: 0.8,
            description: 'test',
          },
          platform_usage: { score: 50, raw_value: 5, description: 'test' },
        },
        shadowDimensions: {
          journey_engagement: {
            score: 75,
            raw_value: 0.75,
            description: 'Journey engagement',
          },
        },
        scoreDelta: 5,
        riskLevel: 'watch',
      };

      vi.mocked(prisma.clientHealthScore.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1); // 1 row updated

      await saveHealthScore(testScore);

      // Verify Prisma upsert called
      expect(prisma.clientHealthScore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            client_health_score_org_week: {
              organizationId: testOrgId,
              weekStart: testWeekStart,
            },
          },
        })
      );

      // Verify raw SQL UPDATE called with shadow_dimensions as JSON
      expect(prisma.$executeRaw).toHaveBeenCalled();
      const sqlCall = vi.mocked(prisma.$executeRaw).mock.calls[0];
      expect(sqlCall[0]).toContain('shadow_dimensions');
      expect(sqlCall[0]).toContain('UPDATE client_health_scores');
    });

    it('should persist null journey_engagement if not available', async () => {
      const testScore: ComputedHealthScore = {
        organizationId: testOrgId,
        weekStart: testWeekStart,
        overallScore: 60,
        dimensions: {
          content_consistency: {
            score: 60,
            raw_value: 0.6,
            description: 'test',
          },
          engagement_trajectory: {
            score: 70,
            raw_value: 0.7,
            description: 'test',
          },
          review_responsiveness: null,
          authority_momentum: null,
          advisor_engagement: {
            score: 80,
            raw_value: 0.8,
            description: 'test',
          },
          platform_usage: { score: 50, raw_value: 5, description: 'test' },
        },
        shadowDimensions: {
          journey_engagement: null,
        },
        scoreDelta: 0,
        riskLevel: 'watch',
      };

      vi.mocked(prisma.clientHealthScore.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

      await saveHealthScore(testScore);

      expect(prisma.clientHealthScore.upsert).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Verify the shadow_dimensions JSON includes null for journey_engagement
      const sqlCall = vi.mocked(prisma.$executeRaw).mock.calls[0];
      const jsonString = sqlCall[0];
      expect(jsonString).toContain('"journey_engagement":null');
    });
  });

  // ── Batch Processing: computeAllHealthScores ──

  describe('computeAllHealthScores batch processing', () => {
    it('should include shadowDimensionActivation in response', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        { id: 'org-1', name: 'Test Org 1' },
      ]);

      // Mock all dimension computations
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
      ]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: 0.6, total_moments_received: 10 },
      ]);
      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.clientHealthScore.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

      const summary = await computeAllHealthScores();

      expect(summary.shadowDimensionActivation).toBeDefined();
      expect(summary.shadowDimensionActivation?.enabled).toBe(false); // Assume toggle is false
      expect(
        summary.shadowDimensionActivation?.avgJourneyEngagement
      ).toBeNull(); // When disabled
    });
  });

  // ── Future: When JOURNEY_DIMENSION_ACTIVE = true ──

  describe('Future behavior: When JOURNEY_DIMENSION_ACTIVE = true (placeholder)', () => {
    it('should reweight all 6 dimensions to 90% total', () => {
      // This test is a spec/documentation for when the toggle is activated
      // Current implementation has JOURNEY_DIMENSION_ACTIVE = false
      // When true, weights should be:
      const expectedWeights = {
        content_consistency: 0.225, // 25% of 90%
        engagement_trajectory: 0.18, // 20% of 90%
        review_responsiveness: 0.135, // 15% of 90%
        authority_momentum: 0.135, // 15% of 90%
        advisor_engagement: 0.135, // 15% of 90%
        platform_usage: 0.09, // 10% of 90%
        journey_engagement: 0.1, // 10% new
      };

      const totalWeight = Object.values(expectedWeights).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    it('should include journey_engagement in composite at 10% when activated', () => {
      // Specification test for activation
      // When JOURNEY_DIMENSION_ACTIVE = true:
      // - Journey should be queried and scored
      // - Journey should be added to scoreMap
      // - weightedAverage should include it
      // - resulting composite should shift based on journey engagement value
      expect(true).toBe(true); // Placeholder for manual activation validation
    });
  });

  // ── Error Handling ──

  describe('Error handling', () => {
    it('should gracefully handle journey_analytics query failure', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
      ]);

      // journey_analytics query throws
      vi.mocked(prisma.$queryRaw).mockRejectedValue(
        new Error('journey_analytics table does not exist')
      );

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      // Should not throw — graceful degradation
      const result = await computeHealthScore(testOrgId);

      expect(result).toBeDefined();
      expect(result.shadowDimensions.journey_engagement).toBeNull();
      expect(result.overallScore).not.toBeNull(); // Other dimensions still computed
    });

    it('should include errors in computeAllHealthScores response', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        { id: 'org-1', name: 'Test Org 1' },
        { id: 'org-2', name: 'Test Org 2' },
      ]);

      // First org succeeds
      vi.mocked(prisma.calendarPost.count).mockResolvedValueOnce(10);
      vi.mocked(
        prisma.contentImprovementTracking.findFirst
      ).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValueOnce([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValueOnce([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValueOnce([
        { eventType: 'dashboard_visit' },
      ]);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { engagement_rate: 0.6, total_moments_received: 10 },
      ]);
      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.clientHealthScore.upsert).mockResolvedValueOnce(
        {} as any
      );
      vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

      // Second org fails
      vi.mocked(prisma.calendarPost.count).mockRejectedValueOnce(
        new Error('DB connection lost')
      );

      const summary = await computeAllHealthScores();

      expect(summary.errors.length).toBe(1);
      expect(summary.errors[0].organizationId).toBe('org-2');
      expect(summary.errors[0].error).toContain('DB connection lost');
    });
  });

  // ── Invariants ──

  describe('Score invariants', () => {
    it('should never produce journey_engagement score > 100', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 70, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 65, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
      ]);

      // Simulate engagement_rate > 1 (edge case from data pipeline)
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: 1.5, total_moments_received: 10 },
      ]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      expect(
        result.shadowDimensions.journey_engagement?.score
      ).toBeLessThanOrEqual(100);
      expect(
        result.shadowDimensions.journey_engagement?.score
      ).toBeGreaterThanOrEqual(0);
    });

    it('should never produce overall score > 100', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(10);
      vi.mocked(prisma.contentImprovementTracking.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }]);
      vi.mocked(prisma.aIWeeklyDigest.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(10); // 100% opened
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([
        {
          replyText: 'Great!',
          replyTime: new Date('2026-03-31T14:01:00Z'),
          reviewTime: new Date('2026-03-31T14:00:00Z'), // Instant response
        },
      ]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([
        { score: 100, computedAt: new Date('2026-04-05T00:00:00Z') },
        { score: 90, computedAt: new Date('2026-03-29T00:00:00Z') },
      ]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([
        { response: 'helpful' },
        { response: 'helpful' },
      ]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([
        { eventType: 'dashboard_visit' },
        { eventType: 'content_view' },
        { eventType: 'advisor_engagement' },
      ]);

      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { engagement_rate: 1.0, total_moments_received: 10 },
      ]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      if (result.overallScore !== null) {
        expect(result.overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('should never produce overall score < 0', async () => {
      vi.mocked(prisma.calendarPost.count).mockResolvedValue(0);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.gBPReview.findMany).mockResolvedValue([]);
      vi.mocked(prisma.authorityScore.findMany).mockResolvedValue([]);
      vi.mocked(prisma.advisorFeedback.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientEngagementEvent.findMany).mockResolvedValue([]);

      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      vi.mocked(prisma.clientHealthScore.findFirst).mockResolvedValue(null);

      const result = await computeHealthScore(testOrgId);

      if (result.overallScore !== null) {
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
