/**
 * Analytics Service - TypeScript Version
 * Integrated with unified database layer
 */

import { db, DatabaseUtils } from '../lib/database';
import { PoolClient } from 'pg';

export interface AnalyticsMetric {
  id?: string;
  platform: string;
  metric_type: string;
  value: number;
  metadata?: Record<string, any>;
  recorded_at: Date;
  user_id?: string;
  campaign_id?: string;
}

export interface AnalyticsInsight {
  id?: string;
  type: string;
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  created_at: Date;
}

export interface PlatformPerformance {
  platform: string;
  metrics: {
    impressions: number;
    engagements: number;
    clicks: number;
    conversions: number;
    reach: number;
    engagement_rate: number;
  };
  period: {
    start: Date;
    end: Date;
  };
}

class AnalyticsService {
  private readonly CACHE_PREFIX = 'analytics:';
  private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes

  /**
   * Track a new analytics metric
   */
  async trackMetric(metric: AnalyticsMetric): Promise<AnalyticsMetric> {
    const query = `
      INSERT INTO analytics_metrics (
        platform, metric_type, value, metadata, 
        recorded_at, user_id, campaign_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      metric.platform,
      metric.metric_type,
      metric.value,
      JSON.stringify(metric.metadata || {}),
      metric.recorded_at || new Date(),
      metric.user_id,
      metric.campaign_id
    ];

    try {
      const result = await db.query<AnalyticsMetric>(query, values);
      
      // Invalidate related caches
      await this.invalidateCache(metric.platform);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error tracking metric:', error);
      throw new Error('Failed to track analytics metric');
    }
  }

  /**
   * Get real-time metrics for a platform
   */
  async getRealtimeMetrics(
    platform: string,
    timeWindow: number = 3600 // 1 hour in seconds
  ): Promise<AnalyticsMetric[]> {
    const cacheKey = `${this.CACHE_PREFIX}realtime:${platform}:${timeWindow}`;
    
    // Check cache first
    const cached = await db.getCached<AnalyticsMetric[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = `
      SELECT * FROM analytics_metrics
      WHERE platform = $1
        AND recorded_at >= NOW() - INTERVAL '${timeWindow} seconds'
      ORDER BY recorded_at DESC
      LIMIT 100
    `;

    try {
      const result = await db.query<AnalyticsMetric>(query, [platform]);
      const metrics = result.rows;
      
      // Cache for shorter duration for real-time data
      await db.cache(cacheKey, metrics, 60); // 1 minute cache
      
      return metrics;
    } catch (error) {
      console.error('Error fetching realtime metrics:', error);
      throw new Error('Failed to fetch realtime metrics');
    }
  }

  /**
   * Get historical metrics with aggregation
   */
  async getHistoricalMetrics(
    platform: string,
    startDate: Date,
    endDate: Date,
    aggregation: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<any[]> {
    const cacheKey = `${this.CACHE_PREFIX}historical:${platform}:${startDate.getTime()}:${endDate.getTime()}:${aggregation}`;
    
    // Check cache
    const cached = await db.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const dateFormat = {
      hour: 'YYYY-MM-DD HH24:00:00',
      day: 'YYYY-MM-DD',
      week: 'YYYY-WW',
      month: 'YYYY-MM'
    }[aggregation];

    const query = `
      SELECT 
        TO_CHAR(recorded_at, '${dateFormat}') as period,
        platform,
        metric_type,
        COUNT(*) as count,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value
      FROM analytics_metrics
      WHERE platform = $1
        AND recorded_at BETWEEN $2 AND $3
      GROUP BY period, platform, metric_type
      ORDER BY period DESC
    `;

    try {
      const result = await db.query(query, [platform, startDate, endDate]);
      const metrics = result.rows;
      
      // Cache for longer duration for historical data
      await db.cache(cacheKey, metrics, this.DEFAULT_CACHE_TTL);
      
      return metrics;
    } catch (error) {
      console.error('Error fetching historical metrics:', error);
      throw new Error('Failed to fetch historical metrics');
    }
  }

  /**
   * Get platform performance summary
   */
  async getPlatformPerformance(
    platform: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PlatformPerformance> {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const end = endDate || new Date();

    const cacheKey = `${this.CACHE_PREFIX}performance:${platform}:${start.getTime()}:${end.getTime()}`;
    
    // Check cache
    const cached = await db.getCached<PlatformPerformance>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = `
      SELECT 
        platform,
        SUM(CASE WHEN metric_type = 'impression' THEN value ELSE 0 END) as impressions,
        SUM(CASE WHEN metric_type = 'engagement' THEN value ELSE 0 END) as engagements,
        SUM(CASE WHEN metric_type = 'click' THEN value ELSE 0 END) as clicks,
        SUM(CASE WHEN metric_type = 'conversion' THEN value ELSE 0 END) as conversions,
        SUM(CASE WHEN metric_type = 'reach' THEN value ELSE 0 END) as reach
      FROM analytics_metrics
      WHERE platform = $1
        AND recorded_at BETWEEN $2 AND $3
      GROUP BY platform
    `;

    try {
      const result = await db.query(query, [platform, start, end]);
      
      if (result.rows.length === 0) {
        return {
          platform,
          metrics: {
            impressions: 0,
            engagements: 0,
            clicks: 0,
            conversions: 0,
            reach: 0,
            engagement_rate: 0
          },
          period: { start, end }
        };
      }

      const data = result.rows[0];
      const engagementRate = data.impressions > 0 
        ? (data.engagements / data.impressions) * 100 
        : 0;

      const performance: PlatformPerformance = {
        platform,
        metrics: {
          impressions: parseInt(data.impressions) || 0,
          engagements: parseInt(data.engagements) || 0,
          clicks: parseInt(data.clicks) || 0,
          conversions: parseInt(data.conversions) || 0,
          reach: parseInt(data.reach) || 0,
          engagement_rate: parseFloat(engagementRate.toFixed(2))
        },
        period: { start, end }
      };

      // Cache the result
      await db.cache(cacheKey, performance, this.DEFAULT_CACHE_TTL);
      
      return performance;
    } catch (error) {
      console.error('Error fetching platform performance:', error);
      throw new Error('Failed to fetch platform performance');
    }
  }

  /**
   * Generate analytics insights using AI
   */
  async generateInsights(
    platform?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    try {
      // Get performance data for analysis
      const platforms = platform ? [platform] : ['twitter', 'linkedin', 'instagram'];
      const performanceData = await Promise.all(
        platforms.map(p => this.getPlatformPerformance(p, timeRange?.start, timeRange?.end))
      );

      // Analyze performance trends
      for (const perf of performanceData) {
        // High engagement rate insight
        if (perf.metrics.engagement_rate > 5) {
          insights.push({
            type: 'performance',
            title: `High Engagement on ${perf.platform}`,
            description: `${perf.platform} is showing exceptional engagement rate of ${perf.metrics.engagement_rate}%`,
            importance: 'high',
            data: perf.metrics,
            created_at: new Date()
          });
        }

        // Low engagement warning
        if (perf.metrics.engagement_rate < 1 && perf.metrics.impressions > 1000) {
          insights.push({
            type: 'warning',
            title: `Low Engagement on ${perf.platform}`,
            description: `Despite ${perf.metrics.impressions} impressions, engagement rate is only ${perf.metrics.engagement_rate}%`,
            importance: 'critical',
            data: perf.metrics,
            created_at: new Date()
          });
        }

        // Growth opportunity
        if (perf.metrics.clicks > perf.metrics.conversions * 10) {
          insights.push({
            type: 'opportunity',
            title: `Conversion Optimization Needed on ${perf.platform}`,
            description: `High click-through but low conversion rate suggests landing page optimization opportunity`,
            importance: 'medium',
            data: {
              clicks: perf.metrics.clicks,
              conversions: perf.metrics.conversions,
              conversion_rate: ((perf.metrics.conversions / perf.metrics.clicks) * 100).toFixed(2)
            },
            created_at: new Date()
          });
        }
      }

      // Store insights in database
      if (insights.length > 0) {
        await this.storeInsights(insights);
      }

      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error('Failed to generate analytics insights');
    }
  }

  /**
   * Store insights in database
   */
  private async storeInsights(insights: AnalyticsInsight[]): Promise<void> {
    const query = `
      INSERT INTO analytics_insights (type, title, description, importance, data)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (title) DO UPDATE
      SET description = EXCLUDED.description,
          data = EXCLUDED.data,
          updated_at = NOW()
    `;

    try {
      await db.transaction(async (client: PoolClient) => {
        for (const insight of insights) {
          await client.query(query, [
            insight.type,
            insight.title,
            insight.description,
            insight.importance,
            JSON.stringify(insight.data)
          ]);
        }
      });
    } catch (error) {
      console.error('Error storing insights:', error);
      // Don't throw - insights are supplementary
    }
  }

  /**
   * Get stored insights
   */
  async getInsights(
    filters?: {
      type?: string;
      importance?: string;
      limit?: number;
    }
  ): Promise<AnalyticsInsight[]> {
    const whereClause = DatabaseUtils.buildWhereClause({
      type: filters?.type,
      importance: filters?.importance
    });

    const query = `
      SELECT * FROM analytics_insights
      ${whereClause.text}
      ORDER BY created_at DESC
      LIMIT $${whereClause.values.length + 1}
    `;

    try {
      const result = await db.query<AnalyticsInsight>(
        query, 
        [...whereClause.values, filters?.limit || 10]
      );
      
      return result.rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      }));
    } catch (error) {
      console.error('Error fetching insights:', error);
      return [];
    }
  }

  /**
   * Invalidate analytics cache
   */
  private async invalidateCache(platform: string): Promise<void> {
    await db.invalidateCache(`${this.CACHE_PREFIX}*${platform}*`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    database: boolean;
    cache: boolean;
  }> {
    try {
      const dbHealth = await db.healthCheck();
      
      return {
        status: dbHealth.postgres ? 'healthy' : 'degraded',
        database: dbHealth.postgres,
        cache: dbHealth.redis
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: false,
        cache: false
      };
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
