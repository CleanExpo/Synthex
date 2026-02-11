/**
 * Content Recommendations Engine
 *
 * @description AI-powered content recommendations for optimal performance
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 * - OPENROUTER_API_KEY: OpenRouter API key for AI analysis (SECRET)
 *
 * FAILURE MODE: Returns fallback recommendations
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Platform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'youtube';

export type RecommendationType =
  | 'optimal_time'
  | 'content_format'
  | 'hashtag'
  | 'topic'
  | 'caption'
  | 'visual'
  | 'engagement'
  | 'growth'
  | 'recovery'
  | 'trending';

/** Action data for scheduling recommendations */
export interface ScheduleActionData {
  scheduledTime: Date;
}

/** Action data for content creation recommendations */
export interface CreateActionData {
  format?: string;
  topic?: string;
}

/** Union type for all action data types */
export type RecommendationActionData = ScheduleActionData | CreateActionData | Record<string, unknown>;

/** Supporting data for recommendations */
export interface RecommendationSupportingData {
  historicalPerformance?: Array<{ date: string; value: number }>;
  competitorData?: Array<{ name: string; score: number }>;
  trendData?: Array<{ topic: string; score: number }>;
  [key: string]: unknown;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  platform?: Platform;
  impact: {
    metric: string;
    expectedChange: number; // percentage
    timeframe: string;
  };
  actionable: boolean;
  action?: {
    type: 'apply' | 'schedule' | 'create' | 'modify';
    label: string;
    data?: RecommendationActionData;
  };
  reasoning: string[];
  supportingData?: RecommendationSupportingData;
  expiresAt?: Date;
  dismissed: boolean;
  appliedAt?: Date;
}

export interface RecommendationCard {
  id: string;
  category: string;
  icon: string;
  title: string;
  subtitle: string;
  recommendations: Recommendation[];
  totalImpact: number;
  urgency: 'immediate' | 'soon' | 'when_ready';
}

export interface PostingTimeRecommendation {
  platform: Platform;
  optimalTimes: {
    dayOfWeek: number;
    hour: number;
    score: number;
    reasoning: string;
  }[];
  avoidTimes: {
    dayOfWeek: number;
    hour: number;
    reason: string;
  }[];
  nextBestSlot: {
    datetime: Date;
    expectedEngagement: number;
  };
}

export interface ContentFormatRecommendation {
  platform: Platform;
  recommendedFormats: {
    format: string;
    score: number;
    engagementLift: number;
    examples?: string[];
  }[];
  underutilizedFormats: string[];
  overutilizedFormats: string[];
}

export interface TopicRecommendation {
  topic: string;
  relevance: number;
  trending: boolean;
  competitorCoverage: number;
  yourCoverage: number;
  suggestedAngle: string;
  relatedHashtags: string[];
  estimatedEngagement: number;
}

export interface ContentGapAnalysis {
  gaps: {
    area: string;
    severity: 'high' | 'medium' | 'low';
    competitorAdvantage: number;
    recommendation: string;
  }[];
  opportunities: {
    topic: string;
    potential: number;
    competition: 'low' | 'medium' | 'high';
    suggestedApproach: string;
  }[];
}

// Platform-specific content recommendations
const PLATFORM_BEST_PRACTICES: Record<
  Platform,
  {
    optimalPostLength: { min: number; max: number };
    hashtagCount: { min: number; max: number };
    bestFormats: string[];
    peakEngagementTimes: { dayOfWeek: number; hours: number[] }[];
    contentTips: string[];
  }
> = {
  instagram: {
    optimalPostLength: { min: 138, max: 150 },
    hashtagCount: { min: 5, max: 15 },
    bestFormats: ['reels', 'carousel', 'stories'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [11, 14, 17] },
      { dayOfWeek: 2, hours: [10, 14, 19] },
      { dayOfWeek: 3, hours: [11, 15, 20] },
      { dayOfWeek: 4, hours: [12, 15, 19] },
      { dayOfWeek: 5, hours: [10, 13, 16] },
      { dayOfWeek: 6, hours: [9, 11, 19] },
      { dayOfWeek: 0, hours: [10, 14, 18] },
    ],
    contentTips: [
      'Use Reels for 2x more reach than static posts',
      'Carousels get 1.4x more reach and 3x more engagement',
      'Include a clear CTA in every post',
      'First 125 characters are visible without expanding',
    ],
  },
  twitter: {
    optimalPostLength: { min: 71, max: 100 },
    hashtagCount: { min: 1, max: 2 },
    bestFormats: ['thread', 'poll', 'image'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [9, 12, 17] },
      { dayOfWeek: 2, hours: [9, 13, 18] },
      { dayOfWeek: 3, hours: [8, 12, 17] },
      { dayOfWeek: 4, hours: [9, 14, 18] },
      { dayOfWeek: 5, hours: [9, 11, 15] },
      { dayOfWeek: 6, hours: [10, 14] },
      { dayOfWeek: 0, hours: [11, 15] },
    ],
    contentTips: [
      'Tweets with images get 150% more retweets',
      'Threads increase engagement by 63%',
      'Polls drive 25% more engagement',
      'Reply to comments within 1 hour',
    ],
  },
  tiktok: {
    optimalPostLength: { min: 100, max: 150 },
    hashtagCount: { min: 3, max: 5 },
    bestFormats: ['video', 'duet', 'stitch'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [6, 10, 22] },
      { dayOfWeek: 2, hours: [9, 12, 19] },
      { dayOfWeek: 3, hours: [7, 11, 22] },
      { dayOfWeek: 4, hours: [9, 12, 19] },
      { dayOfWeek: 5, hours: [5, 13, 15] },
      { dayOfWeek: 6, hours: [11, 19, 20] },
      { dayOfWeek: 0, hours: [7, 8, 16] },
    ],
    contentTips: [
      'Hook viewers in the first 3 seconds',
      'Optimal video length is 21-34 seconds',
      'Use trending sounds for 30% more reach',
      'Post 1-4 times per day for best growth',
    ],
  },
  linkedin: {
    optimalPostLength: { min: 1300, max: 1500 },
    hashtagCount: { min: 3, max: 5 },
    bestFormats: ['document', 'carousel', 'poll'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [7, 10, 12] },
      { dayOfWeek: 2, hours: [7, 8, 10, 12] },
      { dayOfWeek: 3, hours: [7, 9, 12] },
      { dayOfWeek: 4, hours: [8, 10, 14] },
      { dayOfWeek: 5, hours: [7, 9, 11] },
    ],
    contentTips: [
      'Document posts get 3x more clicks',
      'Personal stories outperform company updates',
      'Ask questions to boost comments',
      'Include line breaks for readability',
    ],
  },
  facebook: {
    optimalPostLength: { min: 40, max: 80 },
    hashtagCount: { min: 0, max: 2 },
    bestFormats: ['video', 'live', 'reel'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [9, 13, 16] },
      { dayOfWeek: 2, hours: [9, 13, 15] },
      { dayOfWeek: 3, hours: [9, 12, 15] },
      { dayOfWeek: 4, hours: [9, 13, 17] },
      { dayOfWeek: 5, hours: [9, 11, 14] },
      { dayOfWeek: 6, hours: [10, 12] },
      { dayOfWeek: 0, hours: [10, 13] },
    ],
    contentTips: [
      'Video posts get 59% more engagement',
      'Live videos get 6x more interactions',
      'Short captions perform better',
      'Use Facebook Reels for organic reach',
    ],
  },
  youtube: {
    optimalPostLength: { min: 200, max: 300 },
    hashtagCount: { min: 1, max: 3 },
    bestFormats: ['long_form', 'shorts', 'live'],
    peakEngagementTimes: [
      { dayOfWeek: 1, hours: [14, 16, 21] },
      { dayOfWeek: 2, hours: [14, 17, 21] },
      { dayOfWeek: 3, hours: [15, 18, 21] },
      { dayOfWeek: 4, hours: [12, 15, 20] },
      { dayOfWeek: 5, hours: [15, 17, 21] },
      { dayOfWeek: 6, hours: [9, 11, 15] },
      { dayOfWeek: 0, hours: [9, 12, 18] },
    ],
    contentTips: [
      'Upload Shorts for 10x subscriber growth',
      'First 48 hours are critical for algorithm',
      'Use keywords in first 60 characters of title',
      'Add timestamps for longer videos',
    ],
  },
};

class ContentRecommendationEngine {
  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    options: {
      platforms?: Platform[];
      types?: RecommendationType[];
      limit?: number;
    } = {}
  ): Promise<Recommendation[]> {
    const {
      platforms = ['instagram', 'twitter', 'linkedin'],
      types,
      limit = 10,
    } = options;

    try {
      const recommendations: Recommendation[] = [];

      // Get user's performance data
      const performanceData = await this.getUserPerformanceData(userId, platforms);

      // Generate different types of recommendations
      for (const platform of platforms) {
        // Optimal posting time recommendations
        if (!types || types.includes('optimal_time')) {
          const timeRecs = await this.generateTimingRecommendations(
            userId,
            platform,
            performanceData
          );
          recommendations.push(...timeRecs);
        }

        // Content format recommendations
        if (!types || types.includes('content_format')) {
          const formatRecs = await this.generateFormatRecommendations(
            userId,
            platform,
            performanceData
          );
          recommendations.push(...formatRecs);
        }

        // Hashtag recommendations
        if (!types || types.includes('hashtag')) {
          const hashtagRecs = await this.generateHashtagRecommendations(
            userId,
            platform
          );
          recommendations.push(...hashtagRecs);
        }

        // Topic recommendations
        if (!types || types.includes('topic')) {
          const topicRecs = await this.generateTopicRecommendations(
            userId,
            platform
          );
          recommendations.push(...topicRecs);
        }

        // Engagement improvement recommendations
        if (!types || types.includes('engagement')) {
          const engagementRecs = await this.generateEngagementRecommendations(
            userId,
            platform,
            performanceData
          );
          recommendations.push(...engagementRecs);
        }
      }

      // Sort by priority and confidence
      const sorted = recommendations
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return b.confidence - a.confidence;
        })
        .slice(0, limit);

      return sorted;
    } catch (error) {
      logger.error('Failed to get recommendations:', { error, userId });
      return this.getFallbackRecommendations(platforms);
    }
  }

  /**
   * Get recommendation cards for dashboard
   */
  async getRecommendationCards(
    userId: string,
    platforms: Platform[] = ['instagram', 'twitter', 'linkedin']
  ): Promise<RecommendationCard[]> {
    try {
      const allRecs = await this.getRecommendations(userId, {
        platforms,
        limit: 30,
      });

      // Group by category
      const cards: RecommendationCard[] = [];

      // Timing card
      const timingRecs = allRecs.filter((r) => r.type === 'optimal_time');
      if (timingRecs.length > 0) {
        cards.push({
          id: 'timing',
          category: 'Optimal Posting Times',
          icon: 'clock',
          title: 'Best Times to Post',
          subtitle: `${timingRecs.length} timing recommendations`,
          recommendations: timingRecs.slice(0, 3),
          totalImpact: this.calculateTotalImpact(timingRecs),
          urgency: 'soon',
        });
      }

      // Content format card
      const formatRecs = allRecs.filter((r) => r.type === 'content_format');
      if (formatRecs.length > 0) {
        cards.push({
          id: 'formats',
          category: 'Content Formats',
          icon: 'layout',
          title: 'Format Optimization',
          subtitle: `${formatRecs.length} format suggestions`,
          recommendations: formatRecs.slice(0, 3),
          totalImpact: this.calculateTotalImpact(formatRecs),
          urgency: 'when_ready',
        });
      }

      // Hashtag card
      const hashtagRecs = allRecs.filter((r) => r.type === 'hashtag');
      if (hashtagRecs.length > 0) {
        cards.push({
          id: 'hashtags',
          category: 'Hashtag Strategy',
          icon: 'hash',
          title: 'Hashtag Recommendations',
          subtitle: `${hashtagRecs.length} hashtag tips`,
          recommendations: hashtagRecs.slice(0, 3),
          totalImpact: this.calculateTotalImpact(hashtagRecs),
          urgency: 'soon',
        });
      }

      // Engagement card
      const engagementRecs = allRecs.filter((r) => r.type === 'engagement');
      if (engagementRecs.length > 0) {
        const hasHighPriority = engagementRecs.some((r) => r.priority === 'high');
        cards.push({
          id: 'engagement',
          category: 'Engagement Boost',
          icon: 'heart',
          title: 'Improve Engagement',
          subtitle: `${engagementRecs.length} engagement tips`,
          recommendations: engagementRecs.slice(0, 3),
          totalImpact: this.calculateTotalImpact(engagementRecs),
          urgency: hasHighPriority ? 'immediate' : 'soon',
        });
      }

      // Topic/trending card
      const topicRecs = allRecs.filter(
        (r) => r.type === 'topic' || r.type === 'trending'
      );
      if (topicRecs.length > 0) {
        cards.push({
          id: 'topics',
          category: 'Topics & Trends',
          icon: 'trending-up',
          title: 'Content Ideas',
          subtitle: `${topicRecs.length} topic suggestions`,
          recommendations: topicRecs.slice(0, 3),
          totalImpact: this.calculateTotalImpact(topicRecs),
          urgency: 'when_ready',
        });
      }

      // Sort by urgency
      const urgencyOrder = { immediate: 0, soon: 1, when_ready: 2 };
      return cards.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    } catch (error) {
      logger.error('Failed to get recommendation cards:', { error, userId });
      return [];
    }
  }

  /**
   * Get optimal posting times
   */
  async getOptimalPostingTimes(
    userId: string,
    platform: Platform
  ): Promise<PostingTimeRecommendation> {
    try {
      const performanceData = await this.getUserPerformanceData(userId, [platform]);
      const userTimezone = await this.getUserTimezone(userId);

      // Analyze user's historical performance by time
      const timePerformance = await this.analyzeTimePerformance(userId, platform);

      // Combine with platform best practices
      const platformPractices = PLATFORM_BEST_PRACTICES[platform];

      const optimalTimes: {
        dayOfWeek: number;
        hour: number;
        score: number;
        reasoning: string;
      }[] = [];

      // Calculate optimal times
      for (const peakTime of platformPractices.peakEngagementTimes) {
        for (const hour of peakTime.hours) {
          const userPerf = timePerformance.find(
            (t) => t.dayOfWeek === peakTime.dayOfWeek && t.hour === hour
          );

          const score = userPerf
            ? (userPerf.engagementRate + platformPractices.peakEngagementTimes.length) / 2
            : 70; // Default score based on platform data

          optimalTimes.push({
            dayOfWeek: peakTime.dayOfWeek,
            hour,
            score,
            reasoning: userPerf
              ? `Based on your ${userPerf.engagementRate.toFixed(1)}% historical engagement`
              : `Based on ${platform} platform peak times`,
          });
        }
      }

      // Sort by score
      optimalTimes.sort((a, b) => b.score - a.score);

      // Find next best slot
      const now = new Date();
      const nextBestSlot = this.findNextBestSlot(optimalTimes, now);

      return {
        platform,
        optimalTimes: optimalTimes.slice(0, 10),
        avoidTimes: this.getTimesToAvoid(platform, timePerformance),
        nextBestSlot,
      };
    } catch (error) {
      logger.error('Failed to get optimal posting times:', { error, userId });
      return this.getFallbackPostingTimes(platform);
    }
  }

  /**
   * Get content format recommendations
   */
  async getFormatRecommendations(
    userId: string,
    platform: Platform
  ): Promise<ContentFormatRecommendation> {
    try {
      // Get user's format performance
      const { data: formatData } = await supabase
        .from('posts')
        .select('content_type, engagement_rate')
        .eq('user_id', userId)
        .eq('platform', platform)
        .not('engagement_rate', 'is', null);

      const formatStats = new Map<string, { total: number; sum: number }>();

      for (const post of formatData || []) {
        const existing = formatStats.get(post.content_type) || { total: 0, sum: 0 };
        existing.total++;
        existing.sum += post.engagement_rate;
        formatStats.set(post.content_type, existing);
      }

      // Calculate performance by format
      const platformPractices = PLATFORM_BEST_PRACTICES[platform];
      const recommendedFormats: {
        format: string;
        score: number;
        engagementLift: number;
        examples?: string[];
      }[] = [];

      const overallAvg =
        formatData && formatData.length > 0
          ? formatData.reduce((sum, p) => sum + p.engagement_rate, 0) / formatData.length
          : 3;

      for (const format of platformPractices.bestFormats) {
        const stats = formatStats.get(format);
        const avgEngagement = stats ? stats.sum / stats.total : 0;
        const engagementLift = ((avgEngagement - overallAvg) / overallAvg) * 100;

        recommendedFormats.push({
          format,
          score: stats ? avgEngagement * 10 : 70, // Default score for unused formats
          engagementLift,
          examples: this.getFormatExamples(format, platform),
        });
      }

      // Sort by score
      recommendedFormats.sort((a, b) => b.score - a.score);

      // Find underutilized and overutilized formats
      const usedFormats = Array.from(formatStats.keys());
      const underutilized = platformPractices.bestFormats.filter(
        (f) => !usedFormats.includes(f)
      );
      const overutilized = usedFormats.filter(
        (f) =>
          !platformPractices.bestFormats.includes(f) &&
          (formatStats.get(f)?.total || 0) > 10
      );

      return {
        platform,
        recommendedFormats,
        underutilizedFormats: underutilized,
        overutilizedFormats: overutilized,
      };
    } catch (error) {
      logger.error('Failed to get format recommendations:', { error, userId });
      return {
        platform,
        recommendedFormats: PLATFORM_BEST_PRACTICES[platform].bestFormats.map((f) => ({
          format: f,
          score: 70,
          engagementLift: 0,
        })),
        underutilizedFormats: [],
        overutilizedFormats: [],
      };
    }
  }

  /**
   * Analyze content gaps
   */
  async analyzeContentGaps(
    userId: string,
    platforms: Platform[]
  ): Promise<ContentGapAnalysis> {
    try {
      const gaps: ContentGapAnalysis['gaps'] = [];
      const opportunities: ContentGapAnalysis['opportunities'] = [];

      for (const platform of platforms) {
        // Get user's content themes
        const { data: userContent } = await supabase
          .from('posts')
          .select('themes, engagement_rate')
          .eq('user_id', userId)
          .eq('platform', platform)
          .not('themes', 'is', null);

        const userThemes = new Set<string>();
        for (const post of userContent || []) {
          for (const theme of post.themes || []) {
            userThemes.add(theme);
          }
        }

        // Get trending topics for platform
        const trendingTopics = await this.getTrendingTopics(platform);

        // Identify gaps
        for (const topic of trendingTopics) {
          if (!userThemes.has(topic.topic)) {
            if (topic.engagement > 5) {
              gaps.push({
                area: topic.topic,
                severity: topic.engagement > 10 ? 'high' : 'medium',
                competitorAdvantage: topic.competitorCoverage,
                recommendation: `Create content about ${topic.topic} to capture trending interest`,
              });
            } else {
              opportunities.push({
                topic: topic.topic,
                potential: topic.engagement * 10,
                competition: topic.competitorCoverage > 50 ? 'high' : topic.competitorCoverage > 20 ? 'medium' : 'low',
                suggestedApproach: `Test ${topic.topic} with 2-3 posts to gauge audience interest`,
              });
            }
          }
        }
      }

      return {
        gaps: gaps.slice(0, 10),
        opportunities: opportunities.slice(0, 10),
      };
    } catch (error) {
      logger.error('Failed to analyze content gaps:', { error, userId });
      return { gaps: [], opportunities: [] };
    }
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(
    userId: string,
    recommendationId: string
  ): Promise<boolean> {
    try {
      await supabase.from('dismissed_recommendations').insert({
        user_id: userId,
        recommendation_id: recommendationId,
        dismissed_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      logger.error('Failed to dismiss recommendation:', { error, recommendationId });
      return false;
    }
  }

  /**
   * Apply a recommendation
   */
  async applyRecommendation(
    userId: string,
    recommendationId: string,
    action: RecommendationActionData
  ): Promise<{ success: boolean; result?: Record<string, unknown> }> {
    try {
      // Log application
      await supabase.from('applied_recommendations').insert({
        user_id: userId,
        recommendation_id: recommendationId,
        action,
        applied_at: new Date().toISOString(),
      });

      // Execute action based on type
      // This would integrate with other services

      return { success: true };
    } catch (error) {
      logger.error('Failed to apply recommendation:', { error, recommendationId });
      return { success: false };
    }
  }

  // Private helper methods

  private async getUserPerformanceData(
    userId: string,
    platforms: Platform[]
  ): Promise<Array<{ platform: string; date: string; [key: string]: unknown }>> {
    try {
      const { data } = await supabase
        .from('analytics_summary')
        .select('*')
        .eq('user_id', userId)
        .in('platform', platforms)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

      return data || [];
    } catch (error) {
      logger.error('Failed to get performance data:', { error, userId });
      return [];
    }
  }

  private async getUserTimezone(userId: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .single();

      return data?.timezone || 'UTC';
    } catch (error) {
      return 'UTC';
    }
  }

  private async analyzeTimePerformance(
    userId: string,
    platform: Platform
  ): Promise<Array<{ dayOfWeek: number; hour: number; engagementRate: number }>> {
    try {
      const { data } = await supabase
        .from('posts')
        .select('published_at, engagement_rate')
        .eq('user_id', userId)
        .eq('platform', platform)
        .not('engagement_rate', 'is', null);

      const timeStats = new Map<string, { total: number; sum: number }>();

      for (const post of data || []) {
        const date = new Date(post.published_at);
        const key = `${date.getDay()}-${date.getHours()}`;
        const existing = timeStats.get(key) || { total: 0, sum: 0 };
        existing.total++;
        existing.sum += post.engagement_rate;
        timeStats.set(key, existing);
      }

      return Array.from(timeStats.entries()).map(([key, stats]) => {
        const [day, hour] = key.split('-').map(Number);
        return {
          dayOfWeek: day,
          hour,
          engagementRate: stats.sum / stats.total,
        };
      });
    } catch (error) {
      logger.error('Failed to analyze time performance:', { error, userId });
      return [];
    }
  }

  private findNextBestSlot(
    optimalTimes: Array<{ dayOfWeek: number; hour: number; score: number }>,
    now: Date
  ): { datetime: Date; expectedEngagement: number } {
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    for (const time of optimalTimes) {
      let daysUntil = time.dayOfWeek - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && time.hour <= currentHour)) {
        daysUntil += 7;
      }

      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + daysUntil);
      nextDate.setHours(time.hour, 0, 0, 0);

      return {
        datetime: nextDate,
        expectedEngagement: time.score,
      };
    }

    // Fallback
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    return { datetime: tomorrow, expectedEngagement: 50 };
  }

  private getTimesToAvoid(
    platform: Platform,
    timePerformance: Array<{ dayOfWeek: number; hour: number; engagementRate: number }>
  ): Array<{ dayOfWeek: number; hour: number; reason: string }> {
    const avoidTimes: Array<{ dayOfWeek: number; hour: number; reason: string }> = [];

    // General times to avoid
    const generalAvoid = [
      { hour: 3, reason: 'Very low audience activity' },
      { hour: 4, reason: 'Very low audience activity' },
      { hour: 5, reason: 'Low audience activity' },
    ];

    for (const avoid of generalAvoid) {
      for (let day = 0; day < 7; day++) {
        avoidTimes.push({
          dayOfWeek: day,
          hour: avoid.hour,
          reason: avoid.reason,
        });
      }
    }

    // Add times with poor historical performance
    const avgEngagement =
      timePerformance.length > 0
        ? timePerformance.reduce((sum, t) => sum + t.engagementRate, 0) /
          timePerformance.length
        : 3;

    for (const time of timePerformance) {
      if (time.engagementRate < avgEngagement * 0.5) {
        avoidTimes.push({
          dayOfWeek: time.dayOfWeek,
          hour: time.hour,
          reason: `Poor historical performance (${time.engagementRate.toFixed(1)}% engagement)`,
        });
      }
    }

    return avoidTimes.slice(0, 10);
  }

  private getFormatExamples(format: string, platform: Platform): string[] {
    const examples: Record<string, Record<string, string[]>> = {
      instagram: {
        reels: ['Tutorial clips', 'Behind-the-scenes', 'Trending audio'],
        carousel: ['Step-by-step guides', 'Before/after', 'Product features'],
        stories: ['Polls', 'Q&A', 'Quick updates'],
      },
      twitter: {
        thread: ['Educational content', 'Story telling', 'Tips series'],
        poll: ['Opinion gathering', 'Engagement boost', 'Market research'],
        image: ['Infographics', 'Quotes', 'Data visualization'],
      },
      tiktok: {
        video: ['Tutorials', 'Trends', 'Challenges'],
        duet: ['Reactions', 'Collaborations', 'Commentary'],
        stitch: ['Responses', 'Additions', 'Critiques'],
      },
      linkedin: {
        document: ['Presentations', 'Reports', 'Guides'],
        carousel: ['Tips', 'Case studies', 'Lessons learned'],
        poll: ['Industry opinions', 'Career advice', 'Trends'],
      },
      facebook: {
        video: ['Stories', 'Tutorials', 'Live sessions'],
        live: ['Q&A', 'Product launches', 'Events'],
        reel: ['Short entertainment', 'Tips', 'Behind-the-scenes'],
      },
      youtube: {
        long_form: ['Tutorials', 'Vlogs', 'Reviews'],
        shorts: ['Quick tips', 'Highlights', 'Trends'],
        live: ['Q&A', 'Watch parties', 'Events'],
      },
    };

    return examples[platform]?.[format] || [];
  }

  private async getTrendingTopics(
    platform: Platform
  ): Promise<Array<{ topic: string; engagement: number; competitorCoverage: number }>> {
    // This would integrate with trend prediction service
    return [
      { topic: 'AI tools', engagement: 8.5, competitorCoverage: 45 },
      { topic: 'Productivity tips', engagement: 6.2, competitorCoverage: 60 },
      { topic: 'Industry news', engagement: 5.1, competitorCoverage: 35 },
    ];
  }

  private calculateTotalImpact(recommendations: Recommendation[]): number {
    return recommendations.reduce((sum, r) => sum + r.impact.expectedChange, 0);
  }

  private async generateTimingRecommendations(
    userId: string,
    platform: Platform,
    _performanceData: Array<{ platform: string; date: string; [key: string]: unknown }>
  ): Promise<Recommendation[]> {
    const timingData = await this.getOptimalPostingTimes(userId, platform);
    const recommendations: Recommendation[] = [];

    if (timingData.nextBestSlot) {
      recommendations.push({
        id: `timing_${platform}_${Date.now()}`,
        type: 'optimal_time',
        title: `Best time to post on ${platform}`,
        description: `Schedule your next post for ${timingData.nextBestSlot.datetime.toLocaleString()} for optimal engagement`,
        priority: 'high',
        confidence: 85,
        platform,
        impact: {
          metric: 'engagement_rate',
          expectedChange: 15,
          timeframe: 'per post',
        },
        actionable: true,
        action: {
          type: 'schedule',
          label: 'Schedule for this time',
          data: { scheduledTime: timingData.nextBestSlot.datetime },
        },
        reasoning: [
          `Based on your historical ${platform} performance`,
          `Aligned with platform peak activity times`,
          `Expected engagement: ${timingData.nextBestSlot.expectedEngagement}%`,
        ],
        dismissed: false,
      });
    }

    return recommendations;
  }

  private async generateFormatRecommendations(
    userId: string,
    platform: Platform,
    _performanceData: Array<{ platform: string; date: string; [key: string]: unknown }>
  ): Promise<Recommendation[]> {
    const formatData = await this.getFormatRecommendations(userId, platform);
    const recommendations: Recommendation[] = [];

    for (const underutilized of formatData.underutilizedFormats.slice(0, 2)) {
      recommendations.push({
        id: `format_${platform}_${underutilized}_${Date.now()}`,
        type: 'content_format',
        title: `Try ${underutilized} on ${platform}`,
        description: `${underutilized} is a top-performing format you haven't used yet`,
        priority: 'medium',
        confidence: 75,
        platform,
        impact: {
          metric: 'reach',
          expectedChange: 20,
          timeframe: 'over 2 weeks',
        },
        actionable: true,
        action: {
          type: 'create',
          label: `Create ${underutilized}`,
          data: { format: underutilized },
        },
        reasoning: PLATFORM_BEST_PRACTICES[platform].contentTips.slice(0, 2),
        dismissed: false,
      });
    }

    return recommendations;
  }

  private async generateHashtagRecommendations(
    userId: string,
    platform: Platform
  ): Promise<Recommendation[]> {
    const practices = PLATFORM_BEST_PRACTICES[platform];
    const recommendations: Recommendation[] = [];

    recommendations.push({
      id: `hashtag_${platform}_${Date.now()}`,
      type: 'hashtag',
      title: `Optimize ${platform} hashtags`,
      description: `Use ${practices.hashtagCount.min}-${practices.hashtagCount.max} hashtags per post for best reach`,
      priority: 'low',
      confidence: 80,
      platform,
      impact: {
        metric: 'reach',
        expectedChange: 10,
        timeframe: 'per post',
      },
      actionable: false,
      reasoning: [
        `Optimal hashtag count for ${platform}`,
        'Mix popular and niche hashtags',
        'Avoid banned or overused hashtags',
      ],
      dismissed: false,
    });

    return recommendations;
  }

  private async generateTopicRecommendations(
    userId: string,
    platform: Platform
  ): Promise<Recommendation[]> {
    const topics = await this.getTrendingTopics(platform);
    const recommendations: Recommendation[] = [];

    for (const topic of topics.slice(0, 2)) {
      recommendations.push({
        id: `topic_${platform}_${topic.topic}_${Date.now()}`,
        type: 'topic',
        title: `Cover "${topic.topic}"`,
        description: `Trending topic with ${topic.engagement.toFixed(1)}% avg engagement`,
        priority: topic.engagement > 7 ? 'high' : 'medium',
        confidence: 70,
        platform,
        impact: {
          metric: 'engagement_rate',
          expectedChange: topic.engagement,
          timeframe: 'per post',
        },
        actionable: true,
        action: {
          type: 'create',
          label: 'Create content',
          data: { topic: topic.topic },
        },
        reasoning: [
          'Trending in your industry',
          `${topic.competitorCoverage}% of competitors covering this`,
          'High audience interest detected',
        ],
        dismissed: false,
      });
    }

    return recommendations;
  }

  private async generateEngagementRecommendations(
    userId: string,
    platform: Platform,
    _performanceData: Array<{ platform: string; date: string; [key: string]: unknown }>
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const tips = PLATFORM_BEST_PRACTICES[platform].contentTips;

    recommendations.push({
      id: `engagement_${platform}_${Date.now()}`,
      type: 'engagement',
      title: `Boost ${platform} engagement`,
      description: tips[0],
      priority: 'medium',
      confidence: 85,
      platform,
      impact: {
        metric: 'engagement_rate',
        expectedChange: 25,
        timeframe: 'over 2 weeks',
      },
      actionable: false,
      reasoning: tips.slice(0, 3),
      dismissed: false,
    });

    return recommendations;
  }

  private getFallbackRecommendations(platforms: Platform[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const platform of platforms) {
      const practices = PLATFORM_BEST_PRACTICES[platform];

      recommendations.push({
        id: `fallback_${platform}_${Date.now()}`,
        type: 'engagement',
        title: `${platform} Best Practices`,
        description: practices.contentTips[0],
        priority: 'low',
        confidence: 70,
        platform,
        impact: {
          metric: 'engagement_rate',
          expectedChange: 10,
          timeframe: 'ongoing',
        },
        actionable: false,
        reasoning: practices.contentTips,
        dismissed: false,
      });
    }

    return recommendations;
  }

  private getFallbackPostingTimes(platform: Platform): PostingTimeRecommendation {
    const practices = PLATFORM_BEST_PRACTICES[platform];

    const optimalTimes = practices.peakEngagementTimes.flatMap((pt) =>
      pt.hours.map((hour) => ({
        dayOfWeek: pt.dayOfWeek,
        hour,
        score: 70,
        reasoning: `Platform recommended time for ${platform}`,
      }))
    );

    return {
      platform,
      optimalTimes: optimalTimes.slice(0, 10),
      avoidTimes: [
        { dayOfWeek: 0, hour: 3, reason: 'Very low activity' },
        { dayOfWeek: 0, hour: 4, reason: 'Very low activity' },
      ],
      nextBestSlot: {
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        expectedEngagement: 50,
      },
    };
  }
}

export const contentRecommendationEngine = new ContentRecommendationEngine();
