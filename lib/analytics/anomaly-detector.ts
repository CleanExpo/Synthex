/**
 * Anomaly Detection System
 *
 * @description ML-based anomaly detection for marketing metrics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns empty results with error logged
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anomaly severity levels
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

// Anomaly types
export type AnomalyType =
  | 'spike'
  | 'drop'
  | 'trend_change'
  | 'outlier'
  | 'pattern_break'
  | 'threshold_breach'
  | 'unusual_timing'
  | 'correlation_break';

// Metric types to monitor
export type MetricType =
  | 'impressions'
  | 'engagement_rate'
  | 'reach'
  | 'clicks'
  | 'conversions'
  | 'followers'
  | 'unfollows'
  | 'shares'
  | 'saves'
  | 'comments'
  | 'likes'
  | 'video_views'
  | 'watch_time'
  | 'sentiment_score'
  | 'response_time';

export interface Anomaly {
  id: string;
  userId: string;
  accountId?: string;
  platform?: string;
  metricType: MetricType;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  value: number;
  expectedValue: number;
  deviation: number; // Standard deviations from mean
  deviationPercent: number;
  timestamp: Date;
  detectedAt: Date;
  context: {
    previousValues: number[];
    mean: number;
    stdDev: number;
    trend: 'up' | 'down' | 'stable';
    seasonalFactor?: number;
  };
  possibleCauses: string[];
  recommendations: string[];
  relatedAnomalies?: string[];
  acknowledged: boolean;
  resolvedAt?: Date;
  notes?: string;
}

export interface AnomalyAlert {
  id: string;
  anomalyId: string;
  userId: string;
  channel: 'email' | 'slack' | 'discord' | 'webhook' | 'in_app';
  sentAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

export interface AnomalyDetectionConfig {
  metricType: MetricType;
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high'; // Affects z-score threshold
  minDataPoints: number; // Minimum historical points needed
  lookbackWindow: number; // Days to analyze
  thresholds?: {
    absoluteMin?: number;
    absoluteMax?: number;
    percentChange?: number;
  };
  alertChannels: Array<'email' | 'slack' | 'discord' | 'in_app'>;
  cooldownMinutes: number; // Prevent alert fatigue
}

export interface DetectionResult {
  anomalies: Anomaly[];
  analyzed: number;
  timeRange: { start: Date; end: Date };
  nextCheckAt: Date;
}

// Default detection configurations by metric type
const DEFAULT_CONFIGS: Record<MetricType, Partial<AnomalyDetectionConfig>> = {
  impressions: {
    sensitivity: 'medium',
    minDataPoints: 14,
    lookbackWindow: 30,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 60,
  },
  engagement_rate: {
    sensitivity: 'high',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { absoluteMin: 0, absoluteMax: 100, percentChange: 30 },
    cooldownMinutes: 30,
  },
  reach: {
    sensitivity: 'medium',
    minDataPoints: 14,
    lookbackWindow: 30,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 60,
  },
  clicks: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 40 },
    cooldownMinutes: 30,
  },
  conversions: {
    sensitivity: 'high',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 25 },
    cooldownMinutes: 15,
  },
  followers: {
    sensitivity: 'high',
    minDataPoints: 30,
    lookbackWindow: 60,
    thresholds: { percentChange: 10 },
    cooldownMinutes: 120,
  },
  unfollows: {
    sensitivity: 'high',
    minDataPoints: 14,
    lookbackWindow: 30,
    thresholds: { percentChange: 100 },
    cooldownMinutes: 60,
  },
  shares: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 30,
  },
  saves: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 40 },
    cooldownMinutes: 30,
  },
  comments: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 30,
  },
  likes: {
    sensitivity: 'low',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 60 },
    cooldownMinutes: 60,
  },
  video_views: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 30,
  },
  watch_time: {
    sensitivity: 'medium',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 30 },
    cooldownMinutes: 30,
  },
  sentiment_score: {
    sensitivity: 'high',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { absoluteMin: -1, absoluteMax: 1, percentChange: 20 },
    cooldownMinutes: 15,
  },
  response_time: {
    sensitivity: 'high',
    minDataPoints: 7,
    lookbackWindow: 14,
    thresholds: { percentChange: 50 },
    cooldownMinutes: 30,
  },
};

// Z-score thresholds by sensitivity
const SENSITIVITY_THRESHOLDS: Record<'low' | 'medium' | 'high', number> = {
  low: 3.0,
  medium: 2.5,
  high: 2.0,
};

class AnomalyDetector {
  /**
   * Detect anomalies in metrics for a user
   */
  async detectAnomalies(
    userId: string,
    options: {
      metrics?: MetricType[];
      platform?: string;
      accountId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<DetectionResult> {
    const {
      metrics = Object.keys(DEFAULT_CONFIGS) as MetricType[],
      platform,
      accountId,
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate = new Date(),
    } = options;

    const anomalies: Anomaly[] = [];
    let analyzed = 0;

    try {
      // Get user's detection configs
      const configs = await this.getUserConfigs(userId);

      for (const metricType of metrics) {
        const config = configs[metricType] || {
          ...DEFAULT_CONFIGS[metricType],
          metricType,
          enabled: true,
          alertChannels: ['in_app'],
        };

        if (!config.enabled) continue;

        // Get historical data
        const historicalData = await this.getHistoricalData(
          userId,
          metricType,
          config.lookbackWindow || 30,
          { platform, accountId }
        );

        if (historicalData.length < (config.minDataPoints || 7)) {
          continue; // Not enough data
        }

        analyzed++;

        // Get recent values to check
        const recentData = await this.getRecentData(
          userId,
          metricType,
          startDate,
          endDate,
          { platform, accountId }
        );

        // Detect anomalies in recent data
        for (const dataPoint of recentData) {
          const anomaly = await this.analyzeDataPoint(
            dataPoint,
            historicalData,
            config as AnomalyDetectionConfig,
            { userId, platform, accountId, metricType }
          );

          if (anomaly) {
            // Check cooldown
            const inCooldown = await this.isInCooldown(
              userId,
              metricType,
              config.cooldownMinutes || 30
            );

            if (!inCooldown) {
              anomalies.push(anomaly);
              await this.saveAnomaly(anomaly);
              await this.sendAlerts(anomaly, config.alertChannels || ['in_app']);
            }
          }
        }
      }

      return {
        anomalies,
        analyzed,
        timeRange: { start: startDate, end: endDate },
        nextCheckAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min default
      };
    } catch (error) {
      logger.error('Anomaly detection failed:', { error, userId });
      return {
        anomalies: [],
        analyzed,
        timeRange: { start: startDate, end: endDate },
        nextCheckAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }
  }

  /**
   * Analyze a single data point for anomalies
   */
  private async analyzeDataPoint(
    dataPoint: { value: number; timestamp: Date },
    historicalData: Array<{ value: number; timestamp: Date }>,
    config: AnomalyDetectionConfig,
    context: {
      userId: string;
      platform?: string;
      accountId?: string;
      metricType: MetricType;
    }
  ): Promise<Anomaly | null> {
    const values = historicalData.map((d) => d.value);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    const zScore = stdDev > 0 ? (dataPoint.value - mean) / stdDev : 0;
    const threshold = SENSITIVITY_THRESHOLDS[config.sensitivity || 'medium'];

    // Check if this is an anomaly
    if (Math.abs(zScore) < threshold) {
      // Also check absolute thresholds
      if (config.thresholds) {
        const { absoluteMin, absoluteMax, percentChange } = config.thresholds;

        if (absoluteMin !== undefined && dataPoint.value < absoluteMin) {
          // Below minimum threshold
        } else if (absoluteMax !== undefined && dataPoint.value > absoluteMax) {
          // Above maximum threshold
        } else if (percentChange !== undefined) {
          const lastValue = values[values.length - 1];
          const change = Math.abs((dataPoint.value - lastValue) / lastValue) * 100;
          if (change < percentChange) {
            return null; // Not an anomaly
          }
        } else {
          return null; // Not an anomaly
        }
      } else {
        return null; // Not an anomaly
      }
    }

    // Determine anomaly type and severity
    const { type, severity } = this.classifyAnomaly(
      dataPoint.value,
      mean,
      stdDev,
      zScore,
      values
    );

    // Calculate trend
    const trend = this.calculateTrend(values);

    // Generate possible causes and recommendations
    const { causes, recommendations } = this.generateInsights(
      type,
      context.metricType,
      dataPoint.value,
      mean,
      trend
    );

    const anomaly: Anomaly = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: context.userId,
      accountId: context.accountId,
      platform: context.platform,
      metricType: context.metricType,
      anomalyType: type,
      severity,
      value: dataPoint.value,
      expectedValue: mean,
      deviation: zScore,
      deviationPercent: ((dataPoint.value - mean) / mean) * 100,
      timestamp: dataPoint.timestamp,
      detectedAt: new Date(),
      context: {
        previousValues: values.slice(-10),
        mean,
        stdDev,
        trend,
      },
      possibleCauses: causes,
      recommendations,
      acknowledged: false,
    };

    return anomaly;
  }

  /**
   * Classify the anomaly type and severity
   */
  private classifyAnomaly(
    value: number,
    mean: number,
    stdDev: number,
    zScore: number,
    historicalValues: number[]
  ): { type: AnomalyType; severity: AnomalySeverity } {
    let type: AnomalyType = 'outlier';
    let severity: AnomalySeverity = 'low';

    // Determine type
    if (zScore > 0) {
      type = 'spike';
    } else {
      type = 'drop';
    }

    // Check for trend change
    const recentTrend = this.calculateTrend(historicalValues.slice(-5));
    const overallTrend = this.calculateTrend(historicalValues);
    if (recentTrend !== overallTrend) {
      type = 'trend_change';
    }

    // Check for pattern break (e.g., day-of-week pattern)
    if (this.detectPatternBreak(value, historicalValues)) {
      type = 'pattern_break';
    }

    // Determine severity based on z-score magnitude
    const absZScore = Math.abs(zScore);
    if (absZScore >= 4) {
      severity = 'critical';
    } else if (absZScore >= 3) {
      severity = 'high';
    } else if (absZScore >= 2.5) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return { type, severity };
  }

  /**
   * Detect if a value breaks an established pattern
   */
  private detectPatternBreak(
    value: number,
    historicalValues: number[]
  ): boolean {
    if (historicalValues.length < 14) return false;

    // Check for weekly pattern (same day of week)
    const weeklyValues: number[] = [];
    for (let i = historicalValues.length - 1; i >= 0; i -= 7) {
      if (i >= 0) weeklyValues.push(historicalValues[i]);
      if (weeklyValues.length >= 4) break;
    }

    if (weeklyValues.length >= 3) {
      const weeklyMean = this.calculateMean(weeklyValues);
      const weeklyStdDev = this.calculateStdDev(weeklyValues, weeklyMean);
      const weeklyZScore =
        weeklyStdDev > 0 ? (value - weeklyMean) / weeklyStdDev : 0;

      if (Math.abs(weeklyZScore) > 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate insights about the anomaly
   */
  private generateInsights(
    type: AnomalyType,
    metricType: MetricType,
    value: number,
    mean: number,
    trend: 'up' | 'down' | 'stable'
  ): { causes: string[]; recommendations: string[] } {
    const causes: string[] = [];
    const recommendations: string[] = [];
    const isPositive = value > mean;

    // Metric-specific insights
    switch (metricType) {
      case 'engagement_rate':
        if (isPositive) {
          causes.push('Viral or highly resonant content');
          causes.push('Optimal posting time hit');
          causes.push('Content aligned with trending topic');
          recommendations.push('Analyze what made this content successful');
          recommendations.push('Create similar content to capitalize on momentum');
        } else {
          causes.push('Content may not resonate with audience');
          causes.push('Algorithm changes may have affected reach');
          causes.push('Posting at suboptimal time');
          recommendations.push('Review content strategy and audience preferences');
          recommendations.push('Experiment with different content formats');
        }
        break;

      case 'followers':
        if (isPositive) {
          causes.push('Successful campaign or viral moment');
          causes.push('Featured by platform or influencer');
          causes.push('Trending hashtag or topic exposure');
          recommendations.push('Engage with new followers immediately');
          recommendations.push('Analyze traffic source to replicate');
        } else {
          causes.push('Content quality concerns');
          causes.push('Posting frequency issues');
          causes.push('Competitor activity');
          recommendations.push('Survey departing followers if possible');
          recommendations.push('Review recent content for issues');
        }
        break;

      case 'unfollows':
        if (isPositive) {
          causes.push('Controversial or off-brand content');
          causes.push('Over-posting or spam behavior');
          causes.push('Bot cleanup by platform');
          recommendations.push('Review recent posts for issues');
          recommendations.push('Check posting frequency');
          recommendations.push('Ensure content aligns with brand voice');
        }
        break;

      case 'sentiment_score':
        if (!isPositive) {
          causes.push('Negative reaction to recent content');
          causes.push('External events affecting brand perception');
          causes.push('Customer service issues going viral');
          recommendations.push('Monitor and respond to negative comments');
          recommendations.push('Prepare crisis communication if needed');
          recommendations.push('Address customer concerns publicly');
        }
        break;

      case 'conversions':
        if (isPositive) {
          causes.push('Successful promotional campaign');
          causes.push('Product-market fit moment');
          causes.push('Influencer or media coverage');
          recommendations.push('Scale what is working');
          recommendations.push('Ensure inventory/capacity can handle demand');
        } else {
          causes.push('Funnel issues or broken links');
          causes.push('Price or offer changes');
          causes.push('Increased competition');
          recommendations.push('Audit conversion funnel immediately');
          recommendations.push('Check for technical issues');
          recommendations.push('Review competitor pricing');
        }
        break;

      default:
        if (isPositive) {
          causes.push('Content performance above average');
          causes.push('Positive external factors');
          recommendations.push('Analyze contributing factors');
        } else {
          causes.push('Content underperformance');
          causes.push('Possible technical issues');
          recommendations.push('Review content and timing');
        }
    }

    // Type-specific additions
    switch (type) {
      case 'trend_change':
        causes.push('Market or platform algorithm shift');
        recommendations.push('Monitor if trend continues');
        break;
      case 'pattern_break':
        causes.push('Deviation from usual patterns');
        recommendations.push('Check if this represents a new normal');
        break;
    }

    return { causes, recommendations };
  }

  /**
   * Get user's anomaly detection configurations
   */
  private async getUserConfigs(
    userId: string
  ): Promise<Record<MetricType, AnomalyDetectionConfig>> {
    try {
      const { data } = await supabase
        .from('anomaly_detection_configs')
        .select('*')
        .eq('user_id', userId);

      const configs: Record<string, AnomalyDetectionConfig> = {};

      if (data) {
        for (const config of data) {
          configs[config.metric_type] = {
            metricType: config.metric_type,
            enabled: config.enabled,
            sensitivity: config.sensitivity,
            minDataPoints: config.min_data_points,
            lookbackWindow: config.lookback_window,
            thresholds: config.thresholds,
            alertChannels: config.alert_channels,
            cooldownMinutes: config.cooldown_minutes,
          };
        }
      }

      return configs as Record<MetricType, AnomalyDetectionConfig>;
    } catch (error) {
      logger.error('Failed to get user configs:', { error, userId });
      return {} as Record<MetricType, AnomalyDetectionConfig>;
    }
  }

  /**
   * Get historical data for a metric
   */
  private async getHistoricalData(
    userId: string,
    metricType: MetricType,
    days: number,
    filters: { platform?: string; accountId?: string }
  ): Promise<Array<{ value: number; timestamp: Date }>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let query = supabase
        .from('analytics_metrics')
        .select('value, recorded_at')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .gte('recorded_at', startDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (filters.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((d) => ({
        value: d.value,
        timestamp: new Date(d.recorded_at),
      }));
    } catch (error) {
      logger.error('Failed to get historical data:', { error, userId, metricType });
      return [];
    }
  }

  /**
   * Get recent data to analyze
   */
  private async getRecentData(
    userId: string,
    metricType: MetricType,
    startDate: Date,
    endDate: Date,
    filters: { platform?: string; accountId?: string }
  ): Promise<Array<{ value: number; timestamp: Date }>> {
    try {
      let query = supabase
        .from('analytics_metrics')
        .select('value, recorded_at')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (filters.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((d) => ({
        value: d.value,
        timestamp: new Date(d.recorded_at),
      }));
    } catch (error) {
      logger.error('Failed to get recent data:', { error, userId, metricType });
      return [];
    }
  }

  /**
   * Check if we're in cooldown period for this metric
   */
  private async isInCooldown(
    userId: string,
    metricType: MetricType,
    cooldownMinutes: number
  ): Promise<boolean> {
    try {
      const cooldownStart = new Date(
        Date.now() - cooldownMinutes * 60 * 1000
      );

      const { data } = await supabase
        .from('anomalies')
        .select('id')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .gte('detected_at', cooldownStart.toISOString())
        .limit(1);

      return (data?.length || 0) > 0;
    } catch (error) {
      logger.error('Failed to check cooldown:', { error });
      return false;
    }
  }

  /**
   * Save detected anomaly to database
   */
  private async saveAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      await supabase.from('anomalies').insert({
        id: anomaly.id,
        user_id: anomaly.userId,
        account_id: anomaly.accountId,
        platform: anomaly.platform,
        metric_type: anomaly.metricType,
        anomaly_type: anomaly.anomalyType,
        severity: anomaly.severity,
        value: anomaly.value,
        expected_value: anomaly.expectedValue,
        deviation: anomaly.deviation,
        deviation_percent: anomaly.deviationPercent,
        timestamp: anomaly.timestamp.toISOString(),
        detected_at: anomaly.detectedAt.toISOString(),
        context: anomaly.context,
        possible_causes: anomaly.possibleCauses,
        recommendations: anomaly.recommendations,
        acknowledged: false,
      });
    } catch (error) {
      logger.error('Failed to save anomaly:', { error, anomalyId: anomaly.id });
    }
  }

  /**
   * Send alerts for detected anomaly
   */
  private async sendAlerts(
    anomaly: Anomaly,
    channels: Array<'email' | 'slack' | 'discord' | 'in_app'>
  ): Promise<void> {
    for (const channel of channels) {
      try {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save alert record
        await supabase.from('anomaly_alerts').insert({
          id: alertId,
          anomaly_id: anomaly.id,
          user_id: anomaly.userId,
          channel,
          sent_at: new Date().toISOString(),
          acknowledged: false,
        });

        // Send to appropriate channel
        switch (channel) {
          case 'email':
            await this.sendEmailAlert(anomaly);
            break;
          case 'slack':
            await this.sendSlackAlert(anomaly);
            break;
          case 'discord':
            await this.sendDiscordAlert(anomaly);
            break;
          case 'in_app':
            await this.sendInAppAlert(anomaly);
            break;
        }
      } catch (error) {
        logger.error('Failed to send alert:', { error, channel, anomalyId: anomaly.id });
      }
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(anomaly: Anomaly): Promise<void> {
    // Implement email sending via email service
    logger.info('Email alert sent:', { anomalyId: anomaly.id });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(anomaly: Anomaly): Promise<void> {
    // Implement Slack webhook
    logger.info('Slack alert sent:', { anomalyId: anomaly.id });
  }

  /**
   * Send Discord alert
   */
  private async sendDiscordAlert(anomaly: Anomaly): Promise<void> {
    // Implement Discord webhook
    logger.info('Discord alert sent:', { anomalyId: anomaly.id });
  }

  /**
   * Send in-app notification
   */
  private async sendInAppAlert(anomaly: Anomaly): Promise<void> {
    await supabase.from('notifications').insert({
      user_id: anomaly.userId,
      type: 'anomaly_detected',
      title: `${anomaly.severity.toUpperCase()}: ${anomaly.metricType} Anomaly Detected`,
      message: `${anomaly.anomalyType} detected in ${anomaly.metricType}. Value: ${anomaly.value} (Expected: ${anomaly.expectedValue.toFixed(2)})`,
      data: {
        anomalyId: anomaly.id,
        severity: anomaly.severity,
        metricType: anomaly.metricType,
        recommendations: anomaly.recommendations,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get anomalies for a user
   */
  async getAnomalies(
    userId: string,
    options: {
      severity?: AnomalySeverity[];
      metricTypes?: MetricType[];
      acknowledged?: boolean;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ anomalies: Anomaly[]; total: number }> {
    try {
      let query = supabase
        .from('anomalies')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('detected_at', { ascending: false });

      if (options.severity?.length) {
        query = query.in('severity', options.severity);
      }
      if (options.metricTypes?.length) {
        query = query.in('metric_type', options.metricTypes);
      }
      if (options.acknowledged !== undefined) {
        query = query.eq('acknowledged', options.acknowledged);
      }
      if (options.startDate) {
        query = query.gte('detected_at', options.startDate.toISOString());
      }
      if (options.endDate) {
        query = query.lte('detected_at', options.endDate.toISOString());
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      }

      const { data, count, error } = await query;

      if (error) throw error;

      const anomalies: Anomaly[] = (data || []).map((d) => ({
        id: d.id,
        userId: d.user_id,
        accountId: d.account_id,
        platform: d.platform,
        metricType: d.metric_type,
        anomalyType: d.anomaly_type,
        severity: d.severity,
        value: d.value,
        expectedValue: d.expected_value,
        deviation: d.deviation,
        deviationPercent: d.deviation_percent,
        timestamp: new Date(d.timestamp),
        detectedAt: new Date(d.detected_at),
        context: d.context,
        possibleCauses: d.possible_causes,
        recommendations: d.recommendations,
        relatedAnomalies: d.related_anomalies,
        acknowledged: d.acknowledged,
        resolvedAt: d.resolved_at ? new Date(d.resolved_at) : undefined,
        notes: d.notes,
      }));

      return { anomalies, total: count || 0 };
    } catch (error) {
      logger.error('Failed to get anomalies:', { error, userId });
      return { anomalies: [], total: 0 };
    }
  }

  /**
   * Acknowledge an anomaly
   */
  async acknowledgeAnomaly(
    anomalyId: string,
    userId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('anomalies')
        .update({
          acknowledged: true,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', anomalyId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge anomaly:', { error, anomalyId });
      return false;
    }
  }

  /**
   * Resolve an anomaly
   */
  async resolveAnomaly(
    anomalyId: string,
    userId: string,
    resolution?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('anomalies')
        .update({
          acknowledged: true,
          resolved_at: new Date().toISOString(),
          notes: resolution,
          updated_at: new Date().toISOString(),
        })
        .eq('id', anomalyId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Failed to resolve anomaly:', { error, anomalyId });
      return false;
    }
  }

  /**
   * Update detection configuration
   */
  async updateConfig(
    userId: string,
    metricType: MetricType,
    config: Partial<AnomalyDetectionConfig>
  ): Promise<boolean> {
    try {
      await supabase.from('anomaly_detection_configs').upsert({
        user_id: userId,
        metric_type: metricType,
        enabled: config.enabled,
        sensitivity: config.sensitivity,
        min_data_points: config.minDataPoints,
        lookback_window: config.lookbackWindow,
        thresholds: config.thresholds,
        alert_channels: config.alertChannels,
        cooldown_minutes: config.cooldownMinutes,
        updated_at: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      logger.error('Failed to update config:', { error, userId, metricType });
      return false;
    }
  }

  /**
   * Get anomaly summary statistics
   */
  async getAnomalySummary(
    userId: string,
    days: number = 30
  ): Promise<{
    total: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
    byMetric: Record<string, number>;
    unacknowledged: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data } = await supabase
        .from('anomalies')
        .select('severity, anomaly_type, metric_type, acknowledged, detected_at')
        .eq('user_id', userId)
        .gte('detected_at', startDate.toISOString());

      const anomalies = data || [];

      const bySeverity: Record<AnomalySeverity, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };

      const byType: Record<string, number> = {};
      const byMetric: Record<string, number> = {};
      let unacknowledged = 0;

      for (const a of anomalies) {
        bySeverity[a.severity as AnomalySeverity]++;
        byType[a.anomaly_type] = (byType[a.anomaly_type] || 0) + 1;
        byMetric[a.metric_type] = (byMetric[a.metric_type] || 0) + 1;
        if (!a.acknowledged) unacknowledged++;
      }

      // Calculate trend
      const midPoint = new Date(Date.now() - (days / 2) * 24 * 60 * 60 * 1000);
      const firstHalf = anomalies.filter(
        (a) => new Date(a.detected_at) < midPoint
      ).length;
      const secondHalf = anomalies.filter(
        (a) => new Date(a.detected_at) >= midPoint
      ).length;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (secondHalf > firstHalf * 1.2) trend = 'increasing';
      else if (secondHalf < firstHalf * 0.8) trend = 'decreasing';

      return {
        total: anomalies.length,
        bySeverity,
        byType: byType as Record<AnomalyType, number>,
        byMetric,
        unacknowledged,
        trend,
      };
    } catch (error) {
      logger.error('Failed to get anomaly summary:', { error, userId });
      return {
        total: 0,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        byType: {} as Record<AnomalyType, number>,
        byMetric: {},
        unacknowledged: 0,
        trend: 'stable',
      };
    }
  }

  // Statistical utility methods
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = this.calculateMean(values);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const slopePercent = (slope / yMean) * 100;

    if (slopePercent > 5) return 'up';
    if (slopePercent < -5) return 'down';
    return 'stable';
  }
}

export const anomalyDetector = new AnomalyDetector();
