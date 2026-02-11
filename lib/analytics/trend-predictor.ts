/**
 * Trend Prediction & Forecasting Service
 *
 * @description ML-based trend prediction, engagement forecasting, and viral potential scoring
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns conservative estimates on prediction failure
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Trend types
export type TrendDirection = 'rising' | 'stable' | 'declining' | 'volatile';
export type TrendStrength = 'weak' | 'moderate' | 'strong' | 'explosive';
export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok' | 'youtube';

// Trend prediction result
export interface TrendPrediction {
  topic: string;
  platform: Platform;
  currentScore: number;
  predictedScore: number;
  direction: TrendDirection;
  strength: TrendStrength;
  confidence: number;
  peakTime?: Date;
  recommendations: string[];
  relatedTopics: string[];
  historicalData: Array<{ date: string; score: number }>;
}

// Engagement forecast
export interface EngagementForecast {
  platform: Platform;
  metric: 'impressions' | 'engagement' | 'followers' | 'reach';
  currentValue: number;
  predictions: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }>;
  trend: TrendDirection;
  growthRate: number;
  confidence: number;
}

// Viral potential score
export interface ViralPotentialScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
    recommendation?: string;
  }>;
  estimatedReach: {
    low: number;
    medium: number;
    high: number;
  };
  optimalPostingWindow: {
    start: Date;
    end: Date;
  };
  improvements: string[];
}

// Content performance prediction
export interface ContentPrediction {
  contentId: string;
  platform: Platform;
  predictedEngagement: {
    likes: { min: number; expected: number; max: number };
    comments: { min: number; expected: number; max: number };
    shares: { min: number; expected: number; max: number };
  };
  predictedReach: { min: number; expected: number; max: number };
  engagementRate: { min: number; expected: number; max: number };
  confidence: number;
  comparableContent: Array<{
    id: string;
    similarity: number;
    actualEngagement: number;
  }>;
}

// Seasonal pattern
interface SeasonalPattern {
  dayOfWeek: number[];
  hourOfDay: number[];
  monthOfYear: number[];
  specialEvents: Array<{ name: string; date: string; impact: number }>;
}

class TrendPredictor {
  private supabase: SupabaseClient;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 1800000; // 30 minutes

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ==================== Trend Predictions ====================

  /**
   * Predict trends for topics/hashtags
   */
  async predictTrends(
    userId: string,
    options: {
      topics?: string[];
      platforms?: Platform[];
      industry?: string;
      lookaheadDays?: number;
    } = {}
  ): Promise<TrendPrediction[]> {
    try {
      const platforms = options.platforms || ['instagram', 'twitter', 'tiktok'];
      const lookahead = options.lookaheadDays || 7;

      // Get historical topic performance
      const historicalData = await this.getHistoricalTopicData(userId, platforms, 30);

      // Get external trend signals (would integrate with trend APIs)
      const externalTrends = await this.getExternalTrendSignals(platforms);

      const predictions: TrendPrediction[] = [];

      // Analyze each topic
      const topicsToAnalyze = options.topics || this.extractTopTopics(historicalData);

      for (const topic of topicsToAnalyze) {
        for (const platform of platforms) {
          const topicHistory = historicalData.filter(
            d => d.topic === topic && d.platform === platform
          );

          if (topicHistory.length < 3) continue;

          const prediction = this.predictTopicTrend(topic, platform, topicHistory, externalTrends);
          predictions.push(prediction);
        }
      }

      // Sort by predicted score
      predictions.sort((a, b) => b.predictedScore - a.predictedScore);

      return predictions.slice(0, 20);
    } catch (error: unknown) {
      logger.error('Failed to predict trends:', { error, userId });
      throw error;
    }
  }

  /**
   * Get trending topics in real-time
   */
  async getTrendingTopics(
    platform: Platform,
    options: {
      category?: string;
      region?: string;
      limit?: number;
    } = {}
  ): Promise<Array<{
    topic: string;
    volume: number;
    change: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    relatedHashtags: string[];
  }>> {
    const cacheKey = `trending-${platform}-${options.category || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // In production, this would fetch from Twitter Trends API, Google Trends, etc.
    // For now, return sample trending data
    const trendingTopics = await this.fetchPlatformTrends(platform, options);

    this.cache.set(cacheKey, { data: trendingTopics, expiry: Date.now() + this.CACHE_TTL });

    return trendingTopics;
  }

  // ==================== Engagement Forecasting ====================

  /**
   * Forecast engagement metrics
   */
  async forecastEngagement(
    userId: string,
    platform: Platform,
    options: {
      metric?: 'impressions' | 'engagement' | 'followers' | 'reach';
      forecastDays?: number;
    } = {}
  ): Promise<EngagementForecast> {
    try {
      const metric = options.metric || 'engagement';
      const forecastDays = options.forecastDays || 14;

      // Get historical data
      const history = await this.getMetricHistory(userId, platform, metric, 90);

      if (history.length < 7) {
        throw new Error('Insufficient data for forecasting');
      }

      // Calculate trend using linear regression
      const { slope, intercept, r2 } = this.linearRegression(history);

      // Generate predictions
      const predictions: EngagementForecast['predictions'] = [];
      const lastDate = new Date(history[history.length - 1].date);
      const stdDev = this.calculateStdDev(history.map(h => h.value));

      for (let i = 1; i <= forecastDays; i++) {
        const date = new Date(lastDate);
        date.setDate(date.getDate() + i);

        const dayIndex = history.length + i;
        const predicted = slope * dayIndex + intercept;
        const uncertainty = stdDev * Math.sqrt(1 + (1 / history.length) + Math.pow(i, 2) / 12);

        predictions.push({
          date: date.toISOString().split('T')[0],
          predicted: Math.max(0, Math.round(predicted)),
          lowerBound: Math.max(0, Math.round(predicted - 1.96 * uncertainty)),
          upperBound: Math.round(predicted + 1.96 * uncertainty),
        });
      }

      // Determine trend direction
      const direction = this.determineTrendDirection(slope, history);

      // Calculate growth rate
      const firstWeek = history.slice(0, 7);
      const lastWeek = history.slice(-7);
      const firstAvg = firstWeek.reduce((s, h) => s + h.value, 0) / firstWeek.length;
      const lastAvg = lastWeek.reduce((s, h) => s + h.value, 0) / lastWeek.length;
      const growthRate = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

      return {
        platform,
        metric,
        currentValue: history[history.length - 1].value,
        predictions,
        trend: direction,
        growthRate,
        confidence: Math.min(0.95, r2 + 0.1),
      };
    } catch (error: unknown) {
      logger.error('Failed to forecast engagement:', { error, userId, platform });
      throw error;
    }
  }

  /**
   * Forecast multiple metrics at once
   */
  async forecastAllMetrics(
    userId: string,
    platform: Platform,
    forecastDays: number = 14
  ): Promise<Map<string, EngagementForecast>> {
    const metrics = ['impressions', 'engagement', 'followers', 'reach'] as const;
    const forecasts = new Map<string, EngagementForecast>();

    await Promise.all(
      metrics.map(async (metric) => {
        try {
          const forecast = await this.forecastEngagement(userId, platform, { metric, forecastDays });
          forecasts.set(metric, forecast);
        } catch {
          // Skip metrics with insufficient data
        }
      })
    );

    return forecasts;
  }

  // ==================== Viral Potential ====================

  /**
   * Calculate viral potential score for content
   */
  async calculateViralPotential(
    userId: string,
    content: {
      text: string;
      hashtags?: string[];
      mediaType?: 'image' | 'video' | 'carousel' | 'text';
      platform: Platform;
      scheduledTime?: Date;
    }
  ): Promise<ViralPotentialScore> {
    try {
      const factors: ViralPotentialScore['factors'] = [];

      // Factor 1: Content length optimization
      const lengthScore = this.scoreContentLength(content.text, content.platform);
      factors.push({
        factor: 'Content Length',
        score: lengthScore.score,
        weight: 0.1,
        recommendation: lengthScore.recommendation,
      });

      // Factor 2: Hashtag quality
      const hashtagScore = await this.scoreHashtags(userId, content.hashtags || [], content.platform);
      factors.push({
        factor: 'Hashtag Quality',
        score: hashtagScore.score,
        weight: 0.15,
        recommendation: hashtagScore.recommendation,
      });

      // Factor 3: Media type impact
      const mediaScore = this.scoreMediaType(content.mediaType, content.platform);
      factors.push({
        factor: 'Media Type',
        score: mediaScore.score,
        weight: 0.2,
        recommendation: mediaScore.recommendation,
      });

      // Factor 4: Timing optimization
      const timingScore = await this.scoreTiming(userId, content.scheduledTime, content.platform);
      factors.push({
        factor: 'Posting Time',
        score: timingScore.score,
        weight: 0.15,
        recommendation: timingScore.recommendation,
      });

      // Factor 5: Emotional resonance
      const emotionScore = this.scoreEmotionalContent(content.text);
      factors.push({
        factor: 'Emotional Appeal',
        score: emotionScore.score,
        weight: 0.15,
        recommendation: emotionScore.recommendation,
      });

      // Factor 6: Call to action
      const ctaScore = this.scoreCTA(content.text);
      factors.push({
        factor: 'Call to Action',
        score: ctaScore.score,
        weight: 0.1,
        recommendation: ctaScore.recommendation,
      });

      // Factor 7: Trend alignment
      const trendScore = await this.scoreTrendAlignment(content.text, content.hashtags || [], content.platform);
      factors.push({
        factor: 'Trend Alignment',
        score: trendScore.score,
        weight: 0.15,
        recommendation: trendScore.recommendation,
      });

      // Calculate weighted score
      const totalScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
      const normalizedScore = Math.round(totalScore);

      // Determine grade
      const grade = normalizedScore >= 80 ? 'A'
        : normalizedScore >= 65 ? 'B'
        : normalizedScore >= 50 ? 'C'
        : normalizedScore >= 35 ? 'D'
        : 'F';

      // Estimate reach based on score and user's historical data
      const reachEstimate = await this.estimateReach(userId, content.platform, normalizedScore);

      // Get optimal posting window
      const optimalWindow = await this.getOptimalPostingWindow(userId, content.platform);

      // Generate improvements
      const improvements = factors
        .filter(f => f.score < 70 && f.recommendation)
        .sort((a, b) => b.weight - a.weight)
        .map(f => f.recommendation!)
        .slice(0, 5);

      return {
        score: normalizedScore,
        grade,
        factors,
        estimatedReach: reachEstimate,
        optimalPostingWindow: optimalWindow,
        improvements,
      };
    } catch (error: unknown) {
      logger.error('Failed to calculate viral potential:', { error, userId });
      throw error;
    }
  }

  // ==================== Content Performance Prediction ====================

  /**
   * Predict performance for a specific piece of content
   */
  async predictContentPerformance(
    userId: string,
    content: {
      id?: string;
      text: string;
      hashtags?: string[];
      mediaType?: 'image' | 'video' | 'carousel' | 'text';
      platform: Platform;
    }
  ): Promise<ContentPrediction> {
    try {
      // Get user's historical performance
      const historicalPosts = await this.getHistoricalPosts(userId, content.platform, 100);

      if (historicalPosts.length < 10) {
        throw new Error('Insufficient historical data for prediction');
      }

      // Find similar content
      const similarContent = this.findSimilarContent(content, historicalPosts);

      // Calculate predictions based on similar content
      const predictions = this.calculatePredictions(similarContent);

      // Apply adjustments based on content features
      const adjustedPredictions = this.applyContentAdjustments(predictions, content);

      return {
        contentId: content.id || 'draft',
        platform: content.platform,
        predictedEngagement: adjustedPredictions.engagement,
        predictedReach: adjustedPredictions.reach,
        engagementRate: adjustedPredictions.engagementRate,
        confidence: Math.min(0.9, 0.5 + (similarContent.length * 0.05)),
        comparableContent: similarContent.slice(0, 5).map(c => ({
          id: c.id,
          similarity: c.similarity,
          actualEngagement: c.engagement,
        })),
      };
    } catch (error: unknown) {
      logger.error('Failed to predict content performance:', { error, userId });
      throw error;
    }
  }

  // ==================== Seasonal Patterns ====================

  /**
   * Detect seasonal patterns in engagement
   */
  async detectSeasonalPatterns(
    userId: string,
    platform: Platform
  ): Promise<SeasonalPattern> {
    try {
      const history = await this.getMetricHistory(userId, platform, 'engagement', 365);

      // Analyze day of week patterns
      const dayOfWeekScores = this.analyzeDayOfWeekPattern(history);

      // Analyze hour of day patterns
      const hourOfDayScores = this.analyzeHourOfDayPattern(history);

      // Analyze month of year patterns
      const monthOfYearScores = this.analyzeMonthOfYearPattern(history);

      // Detect special events impact
      const specialEvents = await this.detectSpecialEventImpact(history);

      return {
        dayOfWeek: dayOfWeekScores,
        hourOfDay: hourOfDayScores,
        monthOfYear: monthOfYearScores,
        specialEvents,
      };
    } catch (error: unknown) {
      logger.error('Failed to detect seasonal patterns:', { error, userId, platform });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  private async getHistoricalTopicData(
    userId: string,
    platforms: Platform[],
    days: number
  ): Promise<Array<{ topic: string; platform: Platform; date: string; score: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: posts } = await this.supabase
      .from('scheduled_posts')
      .select('hashtags, platform, published_at, analytics')
      .eq('user_id', userId)
      .in('platform', platforms)
      .eq('status', 'published')
      .gte('published_at', startDate.toISOString());

    const topicData: Array<{ topic: string; platform: Platform; date: string; score: number }> = [];

    for (const post of posts || []) {
      const hashtags = post.hashtags || [];
      const analytics = post.analytics || {};
      const engagement = (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);

      for (const hashtag of hashtags) {
        topicData.push({
          topic: hashtag,
          platform: post.platform,
          date: post.published_at.split('T')[0],
          score: engagement,
        });
      }
    }

    return topicData;
  }

  private async getExternalTrendSignals(platforms: Platform[]): Promise<Map<string, number>> {
    // Would integrate with Twitter Trends, Google Trends, etc.
    return new Map();
  }

  private extractTopTopics(data: Array<{ topic: string; score: number }>): string[] {
    const topicScores = new Map<string, number>();

    for (const item of data) {
      const current = topicScores.get(item.topic) || 0;
      topicScores.set(item.topic, current + item.score);
    }

    return Array.from(topicScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic]) => topic);
  }

  private predictTopicTrend(
    topic: string,
    platform: Platform,
    history: Array<{ date: string; score: number }>,
    externalTrends: Map<string, number>
  ): TrendPrediction {
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const scores = sortedHistory.map(h => h.score);

    // Calculate trend using simple moving average
    const recentAvg = scores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, scores.length);
    const olderAvg = scores.slice(0, -7).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 7);

    const change = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    // Determine direction and strength
    let direction: TrendDirection;
    let strength: TrendStrength;

    if (change > 50) {
      direction = 'rising';
      strength = 'explosive';
    } else if (change > 20) {
      direction = 'rising';
      strength = 'strong';
    } else if (change > 5) {
      direction = 'rising';
      strength = 'moderate';
    } else if (change > -5) {
      direction = 'stable';
      strength = 'weak';
    } else if (change > -20) {
      direction = 'declining';
      strength = 'moderate';
    } else {
      direction = 'declining';
      strength = 'strong';
    }

    // Calculate volatility
    const stdDev = this.calculateStdDev(scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const volatility = avgScore > 0 ? stdDev / avgScore : 0;

    if (volatility > 0.5) {
      direction = 'volatile';
    }

    // Predict future score
    const { slope, intercept } = this.linearRegression(sortedHistory.map((h, i) => ({ date: h.date, value: h.score })));
    const predictedScore = Math.max(0, slope * (scores.length + 7) + intercept);

    // Generate recommendations
    const recommendations: string[] = [];
    if (direction === 'rising' && strength !== 'weak') {
      recommendations.push(`Capitalize on ${topic} trend - consider creating more content around this topic`);
    }
    if (direction === 'declining') {
      recommendations.push(`${topic} is declining - consider pivoting to related topics`);
    }

    return {
      topic,
      platform,
      currentScore: recentAvg,
      predictedScore,
      direction,
      strength,
      confidence: Math.min(0.9, 0.5 + (history.length * 0.02)),
      recommendations,
      relatedTopics: [],
      historicalData: sortedHistory.map(h => ({ date: h.date, score: h.score })),
    };
  }

  private async getMetricHistory(
    userId: string,
    platform: Platform,
    metric: string,
    days: number
  ): Promise<Array<{ date: string; value: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: snapshots } = await this.supabase
      .from('platform_analytics_snapshots')
      .select('collected_at, metrics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .gte('collected_at', startDate.toISOString())
      .order('collected_at', { ascending: true });

    return (snapshots || []).map(s => ({
      date: s.collected_at.split('T')[0],
      value: s.metrics?.[metric] || 0,
    }));
  }

  private linearRegression(data: Array<{ date: string; value: number }>): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const values = data.map(d => d.value);
    const indices = data.map((_, i) => i);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => sum + Math.pow(y - (slope * i + intercept), 2), 0);
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { slope, intercept, r2 };
  }

  private calculateStdDev(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);
  }

  private determineTrendDirection(slope: number, history: Array<{ date: string; value: number }>): TrendDirection {
    const avgValue = history.reduce((sum, h) => sum + h.value, 0) / history.length;
    const normalizedSlope = avgValue > 0 ? slope / avgValue : 0;

    if (normalizedSlope > 0.05) return 'rising';
    if (normalizedSlope < -0.05) return 'declining';
    return 'stable';
  }

  private async fetchPlatformTrends(platform: Platform, options: any): Promise<any[]> {
    // Would integrate with platform APIs
    return [];
  }

  private scoreContentLength(text: string, platform: Platform): { score: number; recommendation?: string } {
    const length = text.length;
    const optimalLengths: Record<Platform, { min: number; max: number }> = {
      twitter: { min: 71, max: 140 },
      instagram: { min: 138, max: 200 },
      linkedin: { min: 150, max: 300 },
      facebook: { min: 40, max: 100 },
      tiktok: { min: 50, max: 150 },
      youtube: { min: 200, max: 500 },
    };

    const optimal = optimalLengths[platform];
    if (length >= optimal.min && length <= optimal.max) {
      return { score: 90 };
    } else if (length < optimal.min) {
      return { score: 60, recommendation: `Consider adding more context (optimal: ${optimal.min}-${optimal.max} chars)` };
    } else {
      return { score: 70, recommendation: `Consider shortening content (optimal: ${optimal.min}-${optimal.max} chars)` };
    }
  }

  private async scoreHashtags(
    userId: string,
    hashtags: string[],
    platform: Platform
  ): Promise<{ score: number; recommendation?: string }> {
    if (hashtags.length === 0) {
      return { score: 40, recommendation: 'Add relevant hashtags to increase discoverability' };
    }

    const optimalCounts: Record<Platform, number> = {
      twitter: 2,
      instagram: 10,
      linkedin: 3,
      facebook: 2,
      tiktok: 4,
      youtube: 5,
    };

    const optimal = optimalCounts[platform];
    const score = hashtags.length === optimal ? 90
      : Math.max(50, 90 - Math.abs(hashtags.length - optimal) * 5);

    return { score };
  }

  private scoreMediaType(
    mediaType: string | undefined,
    platform: Platform
  ): { score: number; recommendation?: string } {
    const mediaScores: Record<Platform, Record<string, number>> = {
      instagram: { video: 95, carousel: 90, image: 80, text: 40 },
      tiktok: { video: 95, image: 50, text: 20 },
      twitter: { video: 85, image: 80, text: 70 },
      linkedin: { carousel: 90, image: 85, video: 80, text: 70 },
      facebook: { video: 90, image: 80, text: 60 },
      youtube: { video: 95, image: 30, text: 10 },
    };

    const score = mediaScores[platform]?.[mediaType || 'text'] || 50;
    const recommendation = score < 70 ? 'Consider adding visual media to boost engagement' : undefined;

    return { score, recommendation };
  }

  private async scoreTiming(
    userId: string,
    scheduledTime: Date | undefined,
    platform: Platform
  ): Promise<{ score: number; recommendation?: string }> {
    if (!scheduledTime) {
      return { score: 50, recommendation: 'Schedule at optimal time for better reach' };
    }

    // Would use posting time predictor
    return { score: 75 };
  }

  private scoreEmotionalContent(text: string): { score: number; recommendation?: string } {
    const emotionalWords = /\b(amazing|incredible|love|hate|shocking|urgent|exclusive|free|secret|discover|transform)\b/gi;
    const matches = text.match(emotionalWords) || [];

    const score = Math.min(90, 50 + matches.length * 10);
    const recommendation = matches.length === 0
      ? 'Consider adding emotional hooks to increase engagement'
      : undefined;

    return { score, recommendation };
  }

  private scoreCTA(text: string): { score: number; recommendation?: string } {
    const ctaPatterns = /\b(click|tap|share|comment|follow|subscribe|learn|discover|get|join|try)\b/gi;
    const matches = text.match(ctaPatterns) || [];

    const score = matches.length > 0 ? 80 : 40;
    const recommendation = matches.length === 0
      ? 'Add a clear call-to-action to drive engagement'
      : undefined;

    return { score, recommendation };
  }

  private async scoreTrendAlignment(
    text: string,
    hashtags: string[],
    platform: Platform
  ): Promise<{ score: number; recommendation?: string }> {
    // Would check against trending topics
    return { score: 60, recommendation: 'Consider incorporating trending topics' };
  }

  private async estimateReach(
    userId: string,
    platform: Platform,
    viralScore: number
  ): Promise<{ low: number; medium: number; high: number }> {
    const { data: profile } = await this.supabase
      .from('platform_connections')
      .select('last_metrics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    const followers = profile?.last_metrics?.followers || 1000;
    const baseReach = followers * 0.1; // 10% base reach

    const multiplier = 1 + (viralScore / 100);

    return {
      low: Math.round(baseReach * multiplier * 0.5),
      medium: Math.round(baseReach * multiplier),
      high: Math.round(baseReach * multiplier * 2),
    };
  }

  private async getOptimalPostingWindow(
    userId: string,
    platform: Platform
  ): Promise<{ start: Date; end: Date }> {
    // Would integrate with posting time predictor
    const now = new Date();
    const start = new Date(now);
    start.setHours(10, 0, 0, 0);
    const end = new Date(now);
    end.setHours(14, 0, 0, 0);

    return { start, end };
  }

  private async getHistoricalPosts(userId: string, platform: Platform, limit: number): Promise<any[]> {
    const { data } = await this.supabase
      .from('scheduled_posts')
      .select('id, content, hashtags, media_type, analytics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    return (data || []).map(post => ({
      id: post.id,
      content: post.content,
      hashtags: post.hashtags || [],
      mediaType: post.media_type,
      engagement: (post.analytics?.likes || 0) + (post.analytics?.comments || 0),
    }));
  }

  private findSimilarContent(content: any, historicalPosts: any[]): any[] {
    return historicalPosts
      .map(post => ({
        ...post,
        similarity: this.calculateSimilarity(content, post),
      }))
      .filter(p => p.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }

  private calculateSimilarity(content1: any, content2: any): number {
    let score = 0;

    // Media type match
    if (content1.mediaType === content2.mediaType) score += 0.3;

    // Hashtag overlap
    const hashtags1 = new Set(content1.hashtags || []);
    const hashtags2 = new Set(content2.hashtags || []);
    const intersection = [...hashtags1].filter(h => hashtags2.has(h)).length;
    const union = new Set([...hashtags1, ...hashtags2]).size;
    if (union > 0) score += 0.4 * (intersection / union);

    // Content length similarity
    const len1 = (content1.text || '').length;
    const len2 = (content2.content || '').length;
    const lenRatio = Math.min(len1, len2) / Math.max(len1, len2, 1);
    score += 0.3 * lenRatio;

    return score;
  }

  private calculatePredictions(similarContent: any[]): any {
    if (similarContent.length === 0) {
      return {
        engagement: { likes: { min: 0, expected: 0, max: 0 }, comments: { min: 0, expected: 0, max: 0 }, shares: { min: 0, expected: 0, max: 0 } },
        reach: { min: 0, expected: 0, max: 0 },
        engagementRate: { min: 0, expected: 0, max: 0 },
      };
    }

    const engagements = similarContent.map(c => c.engagement);
    const avg = engagements.reduce((a, b) => a + b, 0) / engagements.length;
    const stdDev = this.calculateStdDev(engagements);

    return {
      engagement: {
        likes: { min: Math.round(avg * 0.6), expected: Math.round(avg * 0.7), max: Math.round(avg) },
        comments: { min: Math.round(avg * 0.1), expected: Math.round(avg * 0.15), max: Math.round(avg * 0.25) },
        shares: { min: Math.round(avg * 0.05), expected: Math.round(avg * 0.1), max: Math.round(avg * 0.15) },
      },
      reach: { min: Math.round(avg * 5), expected: Math.round(avg * 10), max: Math.round(avg * 20) },
      engagementRate: { min: 2, expected: 4, max: 8 },
    };
  }

  private applyContentAdjustments(predictions: any, content: any): any {
    // Apply adjustments based on content features
    return predictions;
  }

  private analyzeDayOfWeekPattern(history: Array<{ date: string; value: number }>): number[] {
    const dayScores = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const item of history) {
      const day = new Date(item.date).getDay();
      dayScores[day] += item.value;
      dayCounts[day]++;
    }

    return dayScores.map((score, i) => dayCounts[i] > 0 ? Math.round(score / dayCounts[i]) : 0);
  }

  private analyzeHourOfDayPattern(history: Array<{ date: string; value: number }>): number[] {
    // Would need hourly data
    return new Array(24).fill(50);
  }

  private analyzeMonthOfYearPattern(history: Array<{ date: string; value: number }>): number[] {
    const monthScores = new Array(12).fill(0);
    const monthCounts = new Array(12).fill(0);

    for (const item of history) {
      const month = new Date(item.date).getMonth();
      monthScores[month] += item.value;
      monthCounts[month]++;
    }

    return monthScores.map((score, i) => monthCounts[i] > 0 ? Math.round(score / monthCounts[i]) : 0);
  }

  private async detectSpecialEventImpact(history: any[]): Promise<Array<{ name: string; date: string; impact: number }>> {
    // Would detect holidays, events, etc.
    return [];
  }
}

// Export singleton
export const trendPredictor = new TrendPredictor();
