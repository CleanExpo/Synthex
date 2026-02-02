/**
 * Metrics Module
 * Business metrics and KPI tracking for SYNTHEX
 *
 * @task UNI-425 - Implement Business Metrics Dashboard
 *
 * @example
 * ```typescript
 * import { getBusinessMetrics, BusinessMetricsPeriod } from '@/lib/metrics';
 *
 * const metrics = await getBusinessMetrics(BusinessMetricsPeriod.LAST_30_DAYS);
 * ```
 */

export {
  getBusinessMetrics,
  getQuickMetrics,
  BusinessMetricsPeriod,
  type UserMetrics,
  type ContentMetrics,
  type CampaignMetrics,
  type EngagementMetrics,
  type PlatformDistribution,
  type AIUsageMetrics,
  type GrowthTrend,
  type BusinessMetricsReport,
  type BusinessHighlight,
} from './business-metrics';
