/**
 * Analytics API Contract Tests
 *
 * Validates that analytics API endpoints conform to their Zod schemas.
 *
 * @module tests/contract/analytics.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  dashboardQuerySchema,
  engagementQuerySchema,
  exportQuerySchema,
  dashboardOverviewResponseSchema,
  engagementAnalyticsResponseSchema,
  analyticsExportResponseSchema,
  analyticsErrorResponseSchema,
  dateRangeSchema,
  granularitySchema,
  metricTypeSchema,
  periodToDateRange,
  getDefaultMetrics,
} from '@/lib/schemas';

describe('Analytics API Contract Tests', () => {
  describe('Query Input Schema Validation', () => {
    it('should validate dashboard query with period', () => {
      const validInput = {
        period: '30d',
        platforms: ['twitter', 'linkedin'],
        granularity: 'day',
        includeBreakdown: true,
      };

      const result = dashboardQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate dashboard query with date range', () => {
      const validInput = {
        period: 'custom',
        dateRange: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T23:59:59.000Z',
        },
        platforms: ['all'],
      };

      const result = dashboardQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate engagement query', () => {
      const validInput = {
        dateRange: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T23:59:59.000Z',
        },
        groupBy: 'platform',
        includeTopPosts: true,
        topPostsLimit: 10,
      };

      const result = engagementQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate export query', () => {
      const validInput = {
        format: 'csv',
        dateRange: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T23:59:59.000Z',
        },
        platforms: ['twitter'],
        metrics: ['impressions', 'engagement', 'reach'],
        includeRawData: true,
      };

      const result = exportQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Date Range Validation', () => {
    it('should validate correct date range', () => {
      const validRange = {
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-31T23:59:59.000Z',
      };

      const result = dateRangeSchema.safeParse(validRange);
      expect(result.success).toBe(true);
    });

    it('should reject date range where start > end', () => {
      const invalidRange = {
        startDate: '2025-02-01T00:00:00.000Z',
        endDate: '2025-01-01T00:00:00.000Z',
      };

      const result = dateRangeSchema.safeParse(invalidRange);
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const invalidRange = {
        startDate: 'not-a-date',
        endDate: '2025-01-31',
      };

      const result = dateRangeSchema.safeParse(invalidRange);
      expect(result.success).toBe(false);
    });
  });

  describe('Response Schema Validation', () => {
    it('should validate dashboard overview response', () => {
      const mockResponse = {
        success: true,
        data: {
          summary: {
            totalImpressions: 150000,
            totalReach: 75000,
            totalEngagement: 12500,
            engagementRate: 8.3,
            followerGrowth: 2500,
          },
          trends: [
            { date: '2025-01-01', value: 5000, change: 500, changePercent: 11.1 },
            { date: '2025-01-02', value: 5500, change: 200, changePercent: 3.8 },
          ],
          breakdown: {
            twitter: 45000,
            linkedin: 55000,
            instagram: 50000,
          },
          topPosts: [
            { id: '123', content: 'Top performing post', engagement: 2500, platform: 'twitter' },
          ],
        },
        meta: {
          platforms: ['twitter', 'linkedin', 'instagram'],
          generatedAt: '2025-01-15T12:00:00.000Z',
        },
      };

      const result = dashboardOverviewResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate engagement analytics response', () => {
      const mockResponse = {
        success: true,
        data: {
          total: {
            likes: 10000,
            comments: 2500,
            shares: 1500,
            saves: 500,
          },
          rate: 8.5,
          trend: [
            { date: '2025-01-01', value: 1000 },
            { date: '2025-01-02', value: 1200 },
          ],
          byPlatform: {
            twitter: 5000,
            linkedin: 3500,
            instagram: 6000,
          },
          topPosts: [{ id: '123', engagement: 2500, engagementRate: 15.2 }],
        },
      };

      const result = engagementAnalyticsResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate export response', () => {
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/exports/report.csv',
          filename: 'analytics-export-2025-01.csv',
          format: 'csv',
          size: 102400,
          expiresAt: '2025-01-16T12:00:00.000Z',
        },
      };

      const result = analyticsExportResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate analytics error response', () => {
      const mockError = {
        success: false,
        error: 'Invalid date range',
        message: 'Start date must be before end date',
        code: 'INVALID_DATE_RANGE',
      };

      const result = analyticsErrorResponseSchema.safeParse(mockError);
      expect(result.success).toBe(true);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all granularity options', () => {
      const granularities = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

      granularities.forEach((granularity) => {
        const result = granularitySchema.safeParse(granularity);
        expect(result.success).toBe(true);
      });
    });

    it('should validate all metric types', () => {
      const metrics = [
        'impressions',
        'reach',
        'engagement',
        'likes',
        'comments',
        'shares',
        'saves',
        'clicks',
        'conversions',
        'followers',
        'unfollowers',
        'profileViews',
        'linkClicks',
        'videoViews',
        'watchTime',
        'bounceRate',
      ];

      metrics.forEach((metric) => {
        const result = metricTypeSchema.safeParse(metric);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Helper Functions', () => {
    it('should convert period to date range - 7d', () => {
      const result = periodToDateRange('7d');

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();

      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('should convert period to date range - 30d', () => {
      const result = periodToDateRange('30d');

      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should get default metrics for twitter', () => {
      const metrics = getDefaultMetrics('twitter');

      expect(metrics).toContain('impressions');
      expect(metrics).toContain('engagement');
      expect(metrics).toContain('likes');
      expect(metrics).toContain('shares');
    });

    it('should get default metrics for youtube', () => {
      const metrics = getDefaultMetrics('youtube');

      expect(metrics).toContain('videoViews');
      expect(metrics).toContain('watchTime');
    });

    it('should get base metrics for all platforms', () => {
      const metrics = getDefaultMetrics('all');

      expect(metrics).toContain('impressions');
      expect(metrics).toContain('reach');
      expect(metrics).toContain('engagement');
    });
  });
});
