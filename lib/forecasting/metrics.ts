/**
 * Forecast Metric Definitions
 *
 * Defines which metrics are available for Prophet forecasting
 * and how they map to data sources.
 *
 * @module lib/forecasting/metrics
 */

import type { ForecastMetric, ForecastPlatform } from './types';

export interface MetricDefinition {
  id: ForecastMetric;
  label: string;
  description: string;
  unit: string;
  dataSource: 'platform_metrics' | 'geo_analysis' | 'authority_analysis';
  /** Minimum data points required for meaningful training */
  minDataPoints: number;
  /** Whether this metric supports per-platform breakdown */
  supportsPlatform: boolean;
}

export const FORECAST_METRICS: Record<ForecastMetric, MetricDefinition> = {
  engagement_rate: {
    id: 'engagement_rate',
    label: 'Engagement Rate',
    description: 'Average engagement rate across content',
    unit: '%',
    dataSource: 'platform_metrics',
    minDataPoints: 30,
    supportsPlatform: true,
  },
  impressions: {
    id: 'impressions',
    label: 'Impressions',
    description: 'Total content impressions',
    unit: 'count',
    dataSource: 'platform_metrics',
    minDataPoints: 30,
    supportsPlatform: true,
  },
  reach: {
    id: 'reach',
    label: 'Reach',
    description: 'Unique accounts reached',
    unit: 'count',
    dataSource: 'platform_metrics',
    minDataPoints: 30,
    supportsPlatform: true,
  },
  clicks: {
    id: 'clicks',
    label: 'Clicks',
    description: 'Total link clicks and interactions',
    unit: 'count',
    dataSource: 'platform_metrics',
    minDataPoints: 20,
    supportsPlatform: true,
  },
  conversions: {
    id: 'conversions',
    label: 'Conversions',
    description: 'Goal completions from content',
    unit: 'count',
    dataSource: 'platform_metrics',
    minDataPoints: 20,
    supportsPlatform: true,
  },
  geo_score: {
    id: 'geo_score',
    label: 'GEO Score',
    description: 'Generative Engine Optimisation score trend',
    unit: 'score',
    dataSource: 'geo_analysis',
    minDataPoints: 15,
    supportsPlatform: false,
  },
  authority_score: {
    id: 'authority_score',
    label: 'Authority Score',
    description: 'Domain authority and trust score trend',
    unit: 'score',
    dataSource: 'authority_analysis',
    minDataPoints: 10,
    supportsPlatform: false,
  },
  follower_growth: {
    id: 'follower_growth',
    label: 'Follower Growth',
    description: 'Net new followers per day',
    unit: 'count',
    dataSource: 'platform_metrics',
    minDataPoints: 30,
    supportsPlatform: true,
  },
};

/**
 * Get metric definition by ID.
 */
export function getMetricDefinition(metric: ForecastMetric): MetricDefinition {
  return FORECAST_METRICS[metric];
}

/**
 * Get all metrics available for a given platform.
 */
export function getMetricsForPlatform(_platform: ForecastPlatform): MetricDefinition[] {
  return Object.values(FORECAST_METRICS).filter((m) => m.supportsPlatform);
}

/**
 * Get metrics that work without a platform (aggregate-only).
 */
export function getAggregateMetrics(): MetricDefinition[] {
  return Object.values(FORECAST_METRICS).filter((m) => !m.supportsPlatform);
}
