/**
 * Analytics Zod Schemas
 *
 * Validates all analytics-related API requests including
 * dashboard queries, exports, comparisons, and reporting.
 *
 * @module lib/schemas/analytics
 */

import { z } from 'zod';

// =============================================================================
// Common Validators
// =============================================================================

export const uuidSchema = z.string().uuid('Invalid ID format');

export const platformSchema = z.enum([
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'threads',
  'youtube',
  'pinterest',
  'all',
]);

export type Platform = z.infer<typeof platformSchema>;

export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
}).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
  message: 'Start date must be before end date',
});

export type DateRange = z.infer<typeof dateRangeSchema>;

export const granularitySchema = z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']);

export type Granularity = z.infer<typeof granularitySchema>;

export const metricTypeSchema = z.enum([
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
]);

export type MetricType = z.infer<typeof metricTypeSchema>;

// =============================================================================
// Dashboard Analytics Schema
// =============================================================================

export const dashboardQuerySchema = z.object({
  platforms: z.array(platformSchema).optional().default(['all']),
  dateRange: dateRangeSchema.optional(),
  period: z.enum(['today', '7d', '30d', '90d', 'ytd', 'custom']).optional().default('30d'),
  metrics: z.array(metricTypeSchema).optional(),
  granularity: granularitySchema.optional().default('day'),
  timezone: z.string().optional().default('UTC'),
  campaignId: uuidSchema.optional(),
  postIds: z.array(uuidSchema).max(100).optional(),
  includeBreakdown: z.boolean().optional().default(true),
  includeTrends: z.boolean().optional().default(true),
  includeComparison: z.boolean().optional().default(false),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

// =============================================================================
// Engagement Analytics Schema
// =============================================================================

export const engagementQuerySchema = z.object({
  platforms: z.array(platformSchema).optional().default(['all']),
  dateRange: dateRangeSchema,
  groupBy: z.enum(['platform', 'contentType', 'day', 'hour', 'campaign']).optional().default('day'),
  includeTopPosts: z.boolean().optional().default(true),
  topPostsLimit: z.number().min(1).max(50).optional().default(10),
  includeEngagementRate: z.boolean().optional().default(true),
  includeViralScore: z.boolean().optional().default(false),
});

export type EngagementQueryInput = z.infer<typeof engagementQuerySchema>;

// =============================================================================
// Performance Analytics Schema
// =============================================================================

export const performanceQuerySchema = z.object({
  entityType: z.enum(['post', 'campaign', 'platform', 'account']),
  entityId: uuidSchema.optional(),
  dateRange: dateRangeSchema,
  metrics: z.array(metricTypeSchema).min(1, 'At least one metric is required'),
  benchmark: z.enum(['industry', 'historical', 'competitors', 'none']).optional().default('historical'),
  granularity: granularitySchema.optional().default('day'),
});

export type PerformanceQueryInput = z.infer<typeof performanceQuerySchema>;

// =============================================================================
// Realtime Analytics Schema
// =============================================================================

export const realtimeQuerySchema = z.object({
  platforms: z.array(platformSchema).optional().default(['all']),
  refreshInterval: z.number().min(5000).max(60000).optional().default(30000),
  metrics: z.array(z.enum(['activeUsers', 'liveEngagement', 'trending', 'recentPosts'])).optional(),
});

export type RealtimeQueryInput = z.infer<typeof realtimeQuerySchema>;

// =============================================================================
// Insights Analytics Schema
// =============================================================================

export const insightsQuerySchema = z.object({
  platforms: z.array(platformSchema).optional().default(['all']),
  dateRange: dateRangeSchema,
  insightTypes: z
    .array(
      z.enum([
        'bestPostingTime',
        'audienceDemographics',
        'contentPerformance',
        'growthTrends',
        'competitorBenchmark',
        'hashtagAnalysis',
        'sentimentAnalysis',
      ])
    )
    .optional(),
  depth: z.enum(['summary', 'detailed', 'comprehensive']).optional().default('detailed'),
});

export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;

// =============================================================================
// Comparison Analytics Schema
// =============================================================================

export const comparisonQuerySchema = z.object({
  compareType: z.enum(['periods', 'platforms', 'campaigns', 'posts']),
  items: z
    .array(
      z.union([
        dateRangeSchema,
        z.object({ platform: platformSchema }),
        z.object({ campaignId: uuidSchema }),
        z.object({ postId: uuidSchema }),
      ])
    )
    .min(2, 'At least 2 items required for comparison')
    .max(10, 'Maximum 10 items for comparison'),
  metrics: z.array(metricTypeSchema).min(1),
  baseline: z.number().min(0).max(9).optional().default(0),
});

export type ComparisonQueryInput = z.infer<typeof comparisonQuerySchema>;

// =============================================================================
// Trends Analytics Schema
// =============================================================================

export const trendsQuerySchema = z.object({
  metric: metricTypeSchema,
  platforms: z.array(platformSchema).optional().default(['all']),
  dateRange: dateRangeSchema,
  granularity: granularitySchema.optional().default('day'),
  smoothing: z.number().min(1).max(30).optional().default(1),
  includeForecast: z.boolean().optional().default(false),
  forecastPeriods: z.number().min(1).max(90).optional().default(7),
  detectAnomalies: z.boolean().optional().default(false),
});

export type TrendsQueryInput = z.infer<typeof trendsQuerySchema>;

// =============================================================================
// Export Analytics Schema
// =============================================================================

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'json', 'pdf']);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportQuerySchema = z.object({
  format: exportFormatSchema.default('csv'),
  dateRange: dateRangeSchema,
  platforms: z.array(platformSchema).optional().default(['all']),
  metrics: z.array(metricTypeSchema).optional(),
  granularity: granularitySchema.optional().default('day'),
  includeRawData: z.boolean().optional().default(false),
  includeSummary: z.boolean().optional().default(true),
  includeCharts: z.boolean().optional().default(false),
  emailDelivery: z
    .object({
      enabled: z.boolean().default(false),
      recipients: z.array(z.string().email()).max(10).optional(),
    })
    .optional(),
  filename: z.string().max(200).optional(),
  compression: z.boolean().optional().default(false),
});

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

export const bulkExportSchema = z.object({
  exports: z
    .array(
      z.object({
        name: z.string().max(100),
        query: exportQuerySchema,
      })
    )
    .min(1)
    .max(10),
  zipAll: z.boolean().optional().default(true),
  emailDelivery: z
    .object({
      enabled: z.boolean().default(false),
      recipients: z.array(z.string().email()).max(10).optional(),
    })
    .optional(),
});

export type BulkExportInput = z.infer<typeof bulkExportSchema>;

// =============================================================================
// Report Generation Schema
// =============================================================================

export const generateReportSchema = z.object({
  name: z.string().min(1, 'Report name is required').max(200),
  description: z.string().max(1000).optional(),
  dateRange: dateRangeSchema,
  platforms: z.array(platformSchema).optional().default(['all']),
  sections: z
    .array(
      z.object({
        type: z.enum([
          'overview',
          'engagement',
          'growth',
          'content',
          'audience',
          'competitors',
          'recommendations',
        ]),
        title: z.string().max(100).optional(),
        metrics: z.array(metricTypeSchema).optional(),
      })
    )
    .min(1)
    .max(10),
  format: z.enum(['pdf', 'html', 'pptx']).optional().default('pdf'),
  branding: z
    .object({
      logo: z.string().url().optional(),
      colors: z.object({
        primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      }).optional(),
      companyName: z.string().max(100).optional(),
    })
    .optional(),
  schedule: z
    .object({
      enabled: z.boolean().default(false),
      frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
      recipients: z.array(z.string().email()).max(10).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(28).optional(),
      time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    })
    .optional(),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// =============================================================================
// Audience Analytics Schema
// =============================================================================

export const audienceQuerySchema = z.object({
  platforms: z.array(platformSchema).optional().default(['all']),
  dateRange: dateRangeSchema.optional(),
  dimensions: z
    .array(
      z.enum([
        'age',
        'gender',
        'location',
        'language',
        'device',
        'interests',
        'activeHours',
        'followerGrowth',
      ])
    )
    .optional(),
  includeGrowthMetrics: z.boolean().optional().default(true),
  includeEngagementByDemographic: z.boolean().optional().default(false),
});

export type AudienceQueryInput = z.infer<typeof audienceQuerySchema>;

// =============================================================================
// Competitor Analytics Schema
// =============================================================================

export const competitorAnalysisSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().max(100),
        handles: z.record(platformSchema, z.string().max(100)).optional(),
        url: z.string().url().optional(),
      })
    )
    .min(1, 'At least one competitor is required')
    .max(10),
  platforms: z.array(platformSchema).min(1),
  dateRange: dateRangeSchema,
  metrics: z.array(metricTypeSchema).optional(),
  includeContentAnalysis: z.boolean().optional().default(false),
  includeSentimentAnalysis: z.boolean().optional().default(false),
});

export type CompetitorAnalysisInput = z.infer<typeof competitorAnalysisSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate dashboard query
 */
export function validateDashboardQuery(data: unknown): DashboardQueryInput {
  return dashboardQuerySchema.parse(data);
}

/**
 * Validate export query
 */
export function validateExportQuery(data: unknown): ExportQueryInput {
  return exportQuerySchema.parse(data);
}

/**
 * Validate comparison query
 */
export function validateComparisonQuery(data: unknown): ComparisonQueryInput {
  return comparisonQuerySchema.parse(data);
}

/**
 * Validate report generation request
 */
export function validateGenerateReport(data: unknown): GenerateReportInput {
  return generateReportSchema.parse(data);
}

/**
 * Parse period string to date range
 */
export function periodToDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString(),
    endDate,
  };
}

/**
 * Get default metrics for a platform
 */
export function getDefaultMetrics(platform: Platform): MetricType[] {
  const baseMetrics: MetricType[] = ['impressions', 'reach', 'engagement', 'likes', 'comments'];

  const platformSpecific: Record<Platform, MetricType[]> = {
    twitter: [...baseMetrics, 'shares', 'clicks', 'profileViews'],
    linkedin: [...baseMetrics, 'shares', 'clicks', 'profileViews'],
    instagram: [...baseMetrics, 'saves', 'profileViews', 'followers'],
    facebook: [...baseMetrics, 'shares', 'clicks', 'videoViews'],
    tiktok: [...baseMetrics, 'shares', 'videoViews', 'watchTime'],
    threads: [...baseMetrics, 'shares'],
    youtube: ['impressions', 'reach', 'likes', 'comments', 'videoViews', 'watchTime', 'followers'],
    pinterest: [...baseMetrics, 'saves', 'clicks'],
    all: baseMetrics,
  };

  return platformSpecific[platform] || baseMetrics;
}
