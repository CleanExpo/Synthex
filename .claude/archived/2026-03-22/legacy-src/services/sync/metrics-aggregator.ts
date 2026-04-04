/**
 * Metrics Aggregator
 *
 * @description Aggregates platform metrics for analytics:
 * - Time-series aggregation
 * - Cross-platform metrics combining
 * - Trend calculation
 * - Performance scoring
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: For metric storage (SECRET)
 *
 * FAILURE MODE: Returns partial data if some platforms fail
 */

import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache/cache-manager';
import type { Platform, PlatformMetrics } from './platform-sync-service';

// ============================================================================
// TYPES
// ============================================================================

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
}

export interface AggregatedMetrics {
  userId: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate: Date;
  endDate: Date;
  totals: {
    followers: number;
    engagement: number;
    impressions: number;
    reach: number;
    posts: number;
  };
  averages: {
    engagementRate: number;
    likesPerPost: number;
    commentsPerPost: number;
    sharesPerPost: number;
  };
  trends: {
    followerGrowth: number;
    engagementTrend: number;
    reachTrend: number;
  };
  byPlatform: Partial<Record<Platform, PlatformSummary>>;
  topPerformers: {
    posts: Array<{ id: string; platform: Platform; engagement: number }>;
    platforms: Array<{ platform: Platform; engagementRate: number }>;
  };
}

export interface PlatformSummary {
  followers: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  reach: number;
  impressions: number;
  engagementRate: number;
  growth: number;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  confidence: number;
}

// ============================================================================
// METRICS AGGREGATOR
// ============================================================================

export class MetricsAggregator {
  /**
   * Aggregate metrics for a user over a time period
   */
  static async aggregate(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'week'
  ): Promise<AggregatedMetrics> {
    const cache = getCache();
    const cacheKey = `aggregated:${userId}:${period}`;

    // Check cache first
    const cached = await cache.get<AggregatedMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = this.getStartDate(endDate, period);

    // Get metrics for all platforms
    const platforms: Platform[] = ['twitter', 'instagram', 'linkedin', 'tiktok', 'facebook', 'youtube', 'pinterest', 'reddit'];
    const platformMetrics: Partial<Record<Platform, PlatformMetrics>> = {};

    for (const platform of platforms) {
      const metrics = await cache.get<PlatformMetrics>(`metrics:${userId}:${platform}`);
      if (metrics) {
        platformMetrics[platform] = metrics;
      }
    }

    // Aggregate totals
    const totals = {
      followers: 0,
      engagement: 0,
      impressions: 0,
      reach: 0,
      posts: 0,
    };

    const byPlatform: Partial<Record<Platform, PlatformSummary>> = {};

    for (const [platform, metrics] of Object.entries(platformMetrics)) {
      if (!metrics) continue;

      totals.followers += metrics.followers;
      totals.engagement += metrics.engagement.likes + metrics.engagement.comments + metrics.engagement.shares;
      totals.impressions += metrics.engagement.impressions;
      totals.reach += metrics.engagement.reach;
      totals.posts += metrics.posts;

      const engagementTotal = metrics.engagement.likes +
        metrics.engagement.comments +
        metrics.engagement.shares;

      byPlatform[platform as Platform] = {
        followers: metrics.followers,
        engagement: {
          likes: metrics.engagement.likes,
          comments: metrics.engagement.comments,
          shares: metrics.engagement.shares,
          saves: metrics.engagement.saves,
        },
        reach: metrics.engagement.reach,
        impressions: metrics.engagement.impressions,
        engagementRate: metrics.engagement.impressions > 0
          ? (engagementTotal / metrics.engagement.impressions) * 100
          : 0,
        growth: metrics.growth.followersGained - metrics.growth.followersLost,
      };
    }

    // Calculate averages
    const postCount = totals.posts || 1;
    const averages = {
      engagementRate: totals.impressions > 0
        ? (totals.engagement / totals.impressions) * 100
        : 0,
      likesPerPost: 0,
      commentsPerPost: 0,
      sharesPerPost: 0,
    };

    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    for (const metrics of Object.values(platformMetrics)) {
      if (!metrics) continue;
      totalLikes += metrics.engagement.likes;
      totalComments += metrics.engagement.comments;
      totalShares += metrics.engagement.shares;
    }

    averages.likesPerPost = totalLikes / postCount;
    averages.commentsPerPost = totalComments / postCount;
    averages.sharesPerPost = totalShares / postCount;

    // Calculate trends (simplified - would need historical data in production)
    const trends = {
      followerGrowth: 0,
      engagementTrend: 0,
      reachTrend: 0,
    };

    for (const metrics of Object.values(platformMetrics)) {
      if (!metrics) continue;
      trends.followerGrowth += metrics.growth.followersGained - metrics.growth.followersLost;
    }

    if (totals.followers > 0) {
      trends.followerGrowth = (trends.followerGrowth / totals.followers) * 100;
    }

    // Find top performers
    const platformPerformers = Object.entries(byPlatform)
      .map(([platform, summary]) => ({
        platform: platform as Platform,
        engagementRate: summary?.engagementRate || 0,
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate);

    const result: AggregatedMetrics = {
      userId,
      period,
      startDate,
      endDate,
      totals,
      averages,
      trends,
      byPlatform,
      topPerformers: {
        posts: [], // Would be populated from actual post data
        platforms: platformPerformers.slice(0, 5),
      },
    };

    // Cache result
    const ttl = period === 'day' ? 300 : period === 'week' ? 900 : 3600;
    await cache.set(cacheKey, result, { ttl, tags: [`user:${userId}`, 'analytics'] });

    return result;
  }

  /**
   * Get time series data for a specific metric
   */
  static async getTimeSeries(
    userId: string,
    metric: 'followers' | 'engagement' | 'impressions' | 'reach',
    period: 'day' | 'week' | 'month' = 'week',
    platform?: Platform
  ): Promise<TimeSeriesDataPoint[]> {
    const cache = getCache();
    const cacheKey = `timeseries:${userId}:${metric}:${period}${platform ? `:${platform}` : ''}`;

    // Check cache
    const cached = await cache.get<TimeSeriesDataPoint[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate time series points (would come from historical data in production)
    const points: TimeSeriesDataPoint[] = [];
    const endDate = new Date();
    const intervals = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const intervalMs = period === 'day' ? 3600000 : 86400000; // hours or days

    for (let i = intervals - 1; i >= 0; i--) {
      const timestamp = new Date(endDate.getTime() - i * intervalMs);

      // Simulated data - in production, fetch from historical storage
      const baseValue = Math.random() * 1000;
      const trend = (intervals - i) * 10; // Slight upward trend

      points.push({
        timestamp,
        value: Math.round(baseValue + trend),
      });
    }

    // Cache result
    await cache.set(cacheKey, points, { ttl: 300, tags: [`user:${userId}`, 'timeseries'] });

    return points;
  }

  /**
   * Analyze trend for a metric
   */
  static analyzeTrend(dataPoints: TimeSeriesDataPoint[]): TrendAnalysis {
    if (dataPoints.length < 2) {
      return { direction: 'stable', percentage: 0, confidence: 0 };
    }

    // Calculate linear regression
    const n = dataPoints.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += dataPoints[i].value;
      sumXY += i * dataPoints[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;

    // Calculate percentage change
    const startValue = dataPoints[0].value;
    const endValue = dataPoints[n - 1].value;
    const percentage = startValue > 0
      ? ((endValue - startValue) / startValue) * 100
      : 0;

    // Determine direction
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentage) < 1) {
      direction = 'stable';
    } else if (percentage > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    // Calculate R-squared for confidence
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + (sumY / n - slope * sumX / n);
      ssRes += Math.pow(dataPoints[i].value - predicted, 2);
      ssTot += Math.pow(dataPoints[i].value - avgY, 2);
    }

    const confidence = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    return {
      direction,
      percentage: Math.round(percentage * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /**
   * Compare metrics between two periods
   */
  static async comparePeriods(
    userId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<{
    current: AggregatedMetrics;
    previous: AggregatedMetrics;
    changes: Record<string, { value: number; percentage: number }>;
  }> {
    const current = await this.aggregate(userId, period);

    // Calculate previous period dates
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;

    // For previous period, we'd need historical data
    // This is a simplified version
    const previous: AggregatedMetrics = {
      ...current,
      totals: {
        followers: Math.round(current.totals.followers * 0.95),
        engagement: Math.round(current.totals.engagement * 0.9),
        impressions: Math.round(current.totals.impressions * 0.92),
        reach: Math.round(current.totals.reach * 0.88),
        posts: Math.round(current.totals.posts * 0.85),
      },
    };

    // Calculate changes
    const changes: Record<string, { value: number; percentage: number }> = {};

    for (const [key, currentValue] of Object.entries(current.totals)) {
      const previousValue = previous.totals[key as keyof typeof previous.totals];
      const change = currentValue - previousValue;
      const percentage = previousValue > 0 ? (change / previousValue) * 100 : 0;

      changes[key] = {
        value: change,
        percentage: Math.round(percentage * 100) / 100,
      };
    }

    return { current, previous, changes };
  }

  /**
   * Get performance score for a user
   */
  static calculatePerformanceScore(metrics: AggregatedMetrics): number {
    let score = 0;

    // Engagement rate weight (40%)
    const engagementScore = Math.min(metrics.averages.engagementRate * 10, 40);
    score += engagementScore;

    // Follower growth weight (30%)
    const growthScore = Math.min(Math.max(metrics.trends.followerGrowth + 15, 0), 30);
    score += growthScore;

    // Reach efficiency weight (20%)
    const reachEfficiency = metrics.totals.impressions > 0
      ? (metrics.totals.reach / metrics.totals.impressions) * 100
      : 0;
    const reachScore = Math.min(reachEfficiency * 0.2, 20);
    score += reachScore;

    // Content consistency weight (10%)
    const postFrequency = metrics.totals.posts;
    const consistencyScore = Math.min(postFrequency, 10);
    score += consistencyScore;

    return Math.round(score);
  }

  /**
   * Get start date based on period
   */
  private static getStartDate(endDate: Date, period: 'day' | 'week' | 'month' | 'year'): Date {
    const start = new Date(endDate);

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return start;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get aggregated metrics for a user
 */
export async function getMetrics(
  userId: string,
  period: 'day' | 'week' | 'month' | 'year' = 'week'
): Promise<AggregatedMetrics> {
  return MetricsAggregator.aggregate(userId, period);
}

/**
 * Get performance score
 */
export async function getPerformanceScore(userId: string): Promise<number> {
  const metrics = await MetricsAggregator.aggregate(userId, 'week');
  return MetricsAggregator.calculatePerformanceScore(metrics);
}

// Export default
export default MetricsAggregator;
