/**
 * Competitive Intelligence Service
 *
 * @description Analyze competitors and benchmark performance
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 * - OPENROUTER_API_KEY: OpenRouter API key for AI analysis (SECRET)
 *
 * FAILURE MODE: Returns empty results with error logged
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

export interface Competitor {
  id: string;
  userId: string;
  name: string;
  handles: Record<Platform, string>;
  website?: string;
  industry?: string;
  notes?: string;
  isActive: boolean;
  addedAt: Date;
  lastAnalyzedAt?: Date;
}

export interface CompetitorProfile {
  competitorId: string;
  platform: Platform;
  handle: string;
  displayName?: string;
  bio?: string;
  followers: number;
  following: number;
  totalPosts: number;
  avgEngagementRate: number;
  postingFrequency: number; // Posts per week
  topHashtags: string[];
  topMentions: string[];
  contentMix: {
    type: string;
    percentage: number;
  }[];
  peakPostingTimes: {
    dayOfWeek: number;
    hour: number;
    engagement: number;
  }[];
  growthRate: {
    followers: number;
    engagement: number;
  };
  lastUpdated: Date;
}

export interface ContentAnalysis {
  competitorId: string;
  platform: Platform;
  postId: string;
  postedAt: Date;
  contentType: 'image' | 'video' | 'carousel' | 'text' | 'story' | 'reel';
  caption?: string;
  hashtags: string[];
  mentions: string[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
    views?: number;
  };
  engagementRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  themes: string[];
  callToAction?: string;
  performanceScore: number; // 0-100 relative to their average
}

export interface BenchmarkReport {
  userId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  competitors: string[];
  platforms: Platform[];
  metrics: {
    your: MetricSet;
    industryAvg: MetricSet;
    topPerformer: MetricSet;
    bottomPerformer: MetricSet;
  };
  rankings: {
    metric: string;
    yourRank: number;
    totalCompetitors: number;
    percentile: number;
  }[];
  gaps: {
    metric: string;
    yourValue: number;
    benchmarkValue: number;
    gap: number;
    gapPercent: number;
    priority: 'high' | 'medium' | 'low';
    recommendations: string[];
  }[];
  opportunities: string[];
  threats: string[];
}

interface MetricSet {
  followers: number;
  followersGrowth: number;
  avgEngagementRate: number;
  postsPerWeek: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  videoViews?: number;
  reachRate?: number;
}

export interface HashtagAnalysis {
  hashtag: string;
  usedByCompetitors: string[];
  totalUses: number;
  avgEngagement: number;
  trend: 'rising' | 'stable' | 'declining';
  recommendation: 'adopt' | 'monitor' | 'avoid';
  reason: string;
}

export interface ContentGap {
  topic: string;
  competitorsCovering: string[];
  avgEngagement: number;
  yourCoverage: boolean;
  opportunity: 'high' | 'medium' | 'low';
  suggestedApproach: string;
}

export interface SentimentComparison {
  competitor: string;
  platform: Platform;
  overallSentiment: number; // -1 to 1
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topPositiveThemes: string[];
  topNegativeThemes: string[];
  responseRate: number;
  avgResponseTime: number; // hours
}

class CompetitiveIntelligence {
  /**
   * Add a competitor to track
   */
  async addCompetitor(
    userId: string,
    data: {
      name: string;
      handles: Partial<Record<Platform, string>>;
      website?: string;
      industry?: string;
      notes?: string;
    }
  ): Promise<Competitor> {
    try {
      const competitor: Competitor = {
        id: `comp_${crypto.randomUUID()}`,
        userId,
        name: data.name,
        handles: data.handles as Record<Platform, string>,
        website: data.website,
        industry: data.industry,
        notes: data.notes,
        isActive: true,
        addedAt: new Date(),
      };

      await supabase.from('competitors').insert({
        id: competitor.id,
        user_id: userId,
        name: competitor.name,
        handles: competitor.handles,
        website: competitor.website,
        industry: competitor.industry,
        notes: competitor.notes,
        is_active: true,
        added_at: competitor.addedAt.toISOString(),
      });

      // Queue initial analysis
      await this.queueCompetitorAnalysis(competitor.id);

      return competitor;
    } catch (error) {
      logger.error('Failed to add competitor:', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's competitors
   */
  async getCompetitors(
    userId: string,
    options: {
      activeOnly?: boolean;
      platform?: Platform;
    } = {}
  ): Promise<Competitor[]> {
    try {
      let query = supabase
        .from('competitors')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (options.activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      let competitors: Competitor[] = (data || []).map((d) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        handles: d.handles,
        website: d.website,
        industry: d.industry,
        notes: d.notes,
        isActive: d.is_active,
        addedAt: new Date(d.added_at),
        lastAnalyzedAt: d.last_analyzed_at
          ? new Date(d.last_analyzed_at)
          : undefined,
      }));

      // Filter by platform if specified
      if (options.platform) {
        competitors = competitors.filter(
          (c) => c.handles[options.platform!]
        );
      }

      return competitors;
    } catch (error) {
      logger.error('Failed to get competitors:', { error, userId });
      return [];
    }
  }

  /**
   * Get competitor profile for a platform
   */
  async getCompetitorProfile(
    competitorId: string,
    platform: Platform
  ): Promise<CompetitorProfile | null> {
    try {
      const { data, error } = await supabase
        .from('competitor_profiles')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('platform', platform)
        .single();

      if (error || !data) return null;

      return {
        competitorId: data.competitor_id,
        platform: data.platform,
        handle: data.handle,
        displayName: data.display_name,
        bio: data.bio,
        followers: data.followers,
        following: data.following,
        totalPosts: data.total_posts,
        avgEngagementRate: data.avg_engagement_rate,
        postingFrequency: data.posting_frequency,
        topHashtags: data.top_hashtags,
        topMentions: data.top_mentions,
        contentMix: data.content_mix,
        peakPostingTimes: data.peak_posting_times,
        growthRate: data.growth_rate,
        lastUpdated: new Date(data.last_updated),
      };
    } catch (error) {
      logger.error('Failed to get competitor profile:', { error, competitorId });
      return null;
    }
  }

  /**
   * Analyze competitor content
   */
  async analyzeCompetitorContent(
    competitorId: string,
    platform: Platform,
    options: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ContentAnalysis[]> {
    try {
      const { limit = 50, startDate, endDate } = options;

      let query = supabase
        .from('competitor_content')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('platform', platform)
        .order('posted_at', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('posted_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('posted_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((d) => ({
        competitorId: d.competitor_id,
        platform: d.platform,
        postId: d.post_id,
        postedAt: new Date(d.posted_at),
        contentType: d.content_type,
        caption: d.caption,
        hashtags: d.hashtags,
        mentions: d.mentions,
        engagement: d.engagement,
        engagementRate: d.engagement_rate,
        sentiment: d.sentiment,
        themes: d.themes,
        callToAction: d.call_to_action,
        performanceScore: d.performance_score,
      }));
    } catch (error) {
      logger.error('Failed to analyze competitor content:', { error, competitorId });
      return [];
    }
  }

  /**
   * Generate benchmark report
   */
  async generateBenchmarkReport(
    userId: string,
    options: {
      competitorIds?: string[];
      platforms?: Platform[];
      period?: { start: Date; end: Date };
    } = {}
  ): Promise<BenchmarkReport> {
    try {
      const {
        competitorIds,
        platforms = ['instagram', 'twitter', 'linkedin'],
        period = {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      } = options;

      // Get competitors
      let competitors = await this.getCompetitors(userId, { activeOnly: true });
      if (competitorIds?.length) {
        competitors = competitors.filter((c) => competitorIds.includes(c.id));
      }

      // Get user's own metrics
      const userMetrics = await this.getUserMetrics(userId, platforms, period);

      // Get competitor metrics
      const competitorMetrics: MetricSet[] = [];
      for (const competitor of competitors) {
        const metrics = await this.getCompetitorMetrics(
          competitor.id,
          platforms,
          period
        );
        competitorMetrics.push(metrics);
      }

      // Calculate aggregates
      const allMetrics = [userMetrics, ...competitorMetrics];
      const industryAvg = this.calculateAverageMetrics(competitorMetrics);
      const topPerformer = this.findTopPerformer(allMetrics);
      const bottomPerformer = this.findBottomPerformer(allMetrics);

      // Calculate rankings
      const rankings = this.calculateRankings(userMetrics, allMetrics);

      // Identify gaps
      const gaps = this.identifyGaps(userMetrics, industryAvg, topPerformer);

      // Identify opportunities and threats
      const { opportunities, threats } = await this.identifyOpportunitiesAndThreats(
        userId,
        competitors,
        platforms
      );

      return {
        userId,
        generatedAt: new Date(),
        period,
        competitors: competitors.map((c) => c.id),
        platforms,
        metrics: {
          your: userMetrics,
          industryAvg,
          topPerformer,
          bottomPerformer,
        },
        rankings,
        gaps,
        opportunities,
        threats,
      };
    } catch (error) {
      logger.error('Failed to generate benchmark report:', { error, userId });
      throw error;
    }
  }

  /**
   * Analyze hashtag usage across competitors
   */
  async analyzeHashtags(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
      limit?: number;
    } = {}
  ): Promise<HashtagAnalysis[]> {
    try {
      const { competitorIds, limit = 50 } = options;

      // Get competitors
      let competitors = await this.getCompetitors(userId, {
        activeOnly: true,
        platform,
      });

      if (competitorIds?.length) {
        competitors = competitors.filter((c) => competitorIds.includes(c.id));
      }

      // Aggregate hashtag data
      const hashtagMap = new Map<
        string,
        {
          competitors: Set<string>;
          totalUses: number;
          engagementSum: number;
          recentTrend: number[];
        }
      >();

      for (const competitor of competitors) {
        const content = await this.analyzeCompetitorContent(
          competitor.id,
          platform,
          { limit: 100 }
        );

        for (const post of content) {
          for (const hashtag of post.hashtags) {
            const existing = hashtagMap.get(hashtag) || {
              competitors: new Set<string>(),
              totalUses: 0,
              engagementSum: 0,
              recentTrend: [],
            };

            existing.competitors.add(competitor.name);
            existing.totalUses++;
            existing.engagementSum += post.engagementRate;
            existing.recentTrend.push(post.engagementRate);

            hashtagMap.set(hashtag, existing);
          }
        }
      }

      // Calculate analysis
      const analyses: HashtagAnalysis[] = [];

      for (const [hashtag, data] of hashtagMap.entries()) {
        const avgEngagement = data.engagementSum / data.totalUses;
        const trend = this.calculateTrend(data.recentTrend);

        let recommendation: 'adopt' | 'monitor' | 'avoid' = 'monitor';
        let reason = '';

        if (avgEngagement > 5 && data.competitors.size >= 2) {
          recommendation = 'adopt';
          reason = 'High engagement across multiple competitors';
        } else if (avgEngagement < 1 || trend === 'declining') {
          recommendation = 'avoid';
          reason = 'Low engagement or declining trend';
        } else {
          reason = 'Moderate performance, worth testing';
        }

        analyses.push({
          hashtag,
          usedByCompetitors: Array.from(data.competitors),
          totalUses: data.totalUses,
          avgEngagement,
          trend,
          recommendation,
          reason,
        });
      }

      // Sort by engagement and limit
      return analyses
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to analyze hashtags:', { error, userId });
      return [];
    }
  }

  /**
   * Identify content gaps
   */
  async identifyContentGaps(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
    } = {}
  ): Promise<ContentGap[]> {
    try {
      const { competitorIds } = options;

      // Get competitors
      let competitors = await this.getCompetitors(userId, {
        activeOnly: true,
        platform,
      });

      if (competitorIds?.length) {
        competitors = competitors.filter((c) => competitorIds.includes(c.id));
      }

      // Analyze competitor topics
      const topicMap = new Map<
        string,
        {
          competitors: Set<string>;
          engagementSum: number;
          count: number;
        }
      >();

      for (const competitor of competitors) {
        const content = await this.analyzeCompetitorContent(
          competitor.id,
          platform,
          { limit: 100 }
        );

        for (const post of content) {
          for (const theme of post.themes) {
            const existing = topicMap.get(theme) || {
              competitors: new Set<string>(),
              engagementSum: 0,
              count: 0,
            };

            existing.competitors.add(competitor.name);
            existing.engagementSum += post.engagementRate;
            existing.count++;

            topicMap.set(theme, existing);
          }
        }
      }

      // Get user's own topics
      const userTopics = await this.getUserTopics(userId, platform);

      // Identify gaps
      const gaps: ContentGap[] = [];

      for (const [topic, data] of topicMap.entries()) {
        const avgEngagement = data.engagementSum / data.count;
        const yourCoverage = userTopics.has(topic);

        if (!yourCoverage && data.competitors.size >= 2 && avgEngagement > 3) {
          let opportunity: 'high' | 'medium' | 'low' = 'low';
          let suggestedApproach = '';

          if (avgEngagement > 5 && data.competitors.size >= 3) {
            opportunity = 'high';
            suggestedApproach = `Create comprehensive content series on ${topic}`;
          } else if (avgEngagement > 3) {
            opportunity = 'medium';
            suggestedApproach = `Test with 2-3 posts on ${topic}`;
          } else {
            suggestedApproach = `Consider occasional mentions of ${topic}`;
          }

          gaps.push({
            topic,
            competitorsCovering: Array.from(data.competitors),
            avgEngagement,
            yourCoverage,
            opportunity,
            suggestedApproach,
          });
        }
      }

      return gaps.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.opportunity] - priorityOrder[b.opportunity];
      });
    } catch (error) {
      logger.error('Failed to identify content gaps:', { error, userId });
      return [];
    }
  }

  /**
   * Compare sentiment across competitors
   */
  async compareSentiment(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
    } = {}
  ): Promise<SentimentComparison[]> {
    try {
      const { competitorIds } = options;

      // Get competitors
      let competitors = await this.getCompetitors(userId, {
        activeOnly: true,
        platform,
      });

      if (competitorIds?.length) {
        competitors = competitors.filter((c) => competitorIds.includes(c.id));
      }

      const comparisons: SentimentComparison[] = [];

      for (const competitor of competitors) {
        const content = await this.analyzeCompetitorContent(
          competitor.id,
          platform,
          { limit: 100 }
        );

        if (content.length === 0) continue;

        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        const positiveThemes = new Map<string, number>();
        const negativeThemes = new Map<string, number>();

        for (const post of content) {
          sentimentCounts[post.sentiment]++;

          if (post.sentiment === 'positive') {
            for (const theme of post.themes) {
              positiveThemes.set(theme, (positiveThemes.get(theme) || 0) + 1);
            }
          } else if (post.sentiment === 'negative') {
            for (const theme of post.themes) {
              negativeThemes.set(theme, (negativeThemes.get(theme) || 0) + 1);
            }
          }
        }

        const total = content.length;
        const overallSentiment =
          (sentimentCounts.positive - sentimentCounts.negative) / total;

        comparisons.push({
          competitor: competitor.name,
          platform,
          overallSentiment,
          sentimentBreakdown: {
            positive: sentimentCounts.positive / total,
            neutral: sentimentCounts.neutral / total,
            negative: sentimentCounts.negative / total,
          },
          topPositiveThemes: Array.from(positiveThemes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([theme]) => theme),
          topNegativeThemes: Array.from(negativeThemes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([theme]) => theme),
          responseRate: 0, // Would need comment reply data
          avgResponseTime: 0, // Would need timestamp data
        });
      }

      return comparisons.sort((a, b) => b.overallSentiment - a.overallSentiment);
    } catch (error) {
      logger.error('Failed to compare sentiment:', { error, userId });
      return [];
    }
  }

  /**
   * Get strategic insights
   */
  async getStrategicInsights(
    userId: string,
    options: {
      platforms?: Platform[];
    } = {}
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    actionItems: { priority: 'high' | 'medium' | 'low'; action: string }[];
  }> {
    try {
      const { platforms = ['instagram', 'twitter', 'linkedin'] } = options;

      const report = await this.generateBenchmarkReport(userId, { platforms });

      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const actionItems: { priority: 'high' | 'medium' | 'low'; action: string }[] = [];

      // Analyze rankings
      for (const ranking of report.rankings) {
        if (ranking.percentile >= 75) {
          strengths.push(
            `Top performer in ${ranking.metric} (${ranking.percentile}th percentile)`
          );
        } else if (ranking.percentile <= 25) {
          weaknesses.push(
            `Below average in ${ranking.metric} (${ranking.percentile}th percentile)`
          );
          actionItems.push({
            priority: 'high',
            action: `Improve ${ranking.metric} to match industry standards`,
          });
        }
      }

      // Analyze gaps
      for (const gap of report.gaps) {
        if (gap.priority === 'high') {
          weaknesses.push(`${gap.metric} gap of ${Math.abs(gap.gapPercent).toFixed(1)}%`);
          actionItems.push({
            priority: 'high',
            action: gap.recommendations[0] || `Close the ${gap.metric} gap`,
          });
        }
      }

      return {
        strengths,
        weaknesses,
        opportunities: report.opportunities,
        threats: report.threats,
        actionItems: actionItems.sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }),
      };
    } catch (error) {
      logger.error('Failed to get strategic insights:', { error, userId });
      return {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: [],
        actionItems: [],
      };
    }
  }

  // Private helper methods

  private async queueCompetitorAnalysis(competitorId: string): Promise<void> {
    // Queue analysis job
    logger.info('Queued competitor analysis:', { competitorId });
  }

  private async getUserMetrics(
    userId: string,
    platforms: Platform[],
    period: { start: Date; end: Date }
  ): Promise<MetricSet> {
    // Get user's own metrics from analytics
    try {
      const { data } = await supabase
        .from('analytics_summary')
        .select('*')
        .eq('user_id', userId)
        .in('platform', platforms)
        .gte('date', period.start.toISOString())
        .lte('date', period.end.toISOString());

      if (!data?.length) {
        return this.getEmptyMetricSet();
      }

      // Aggregate metrics
      return {
        followers: data.reduce((sum, d) => sum + (d.followers || 0), 0) / data.length,
        followersGrowth:
          data.reduce((sum, d) => sum + (d.followers_growth || 0), 0) / data.length,
        avgEngagementRate:
          data.reduce((sum, d) => sum + (d.engagement_rate || 0), 0) / data.length,
        postsPerWeek:
          data.reduce((sum, d) => sum + (d.posts_count || 0), 0) / (data.length / 7),
        avgLikes: data.reduce((sum, d) => sum + (d.avg_likes || 0), 0) / data.length,
        avgComments:
          data.reduce((sum, d) => sum + (d.avg_comments || 0), 0) / data.length,
        avgShares: data.reduce((sum, d) => sum + (d.avg_shares || 0), 0) / data.length,
      };
    } catch (error) {
      logger.error('Failed to get user metrics:', { error, userId });
      return this.getEmptyMetricSet();
    }
  }

  private async getCompetitorMetrics(
    competitorId: string,
    platforms: Platform[],
    period: { start: Date; end: Date }
  ): Promise<MetricSet> {
    try {
      const { data } = await supabase
        .from('competitor_metrics')
        .select('*')
        .eq('competitor_id', competitorId)
        .in('platform', platforms)
        .gte('date', period.start.toISOString())
        .lte('date', period.end.toISOString());

      if (!data?.length) {
        return this.getEmptyMetricSet();
      }

      return {
        followers: data.reduce((sum, d) => sum + (d.followers || 0), 0) / data.length,
        followersGrowth:
          data.reduce((sum, d) => sum + (d.followers_growth || 0), 0) / data.length,
        avgEngagementRate:
          data.reduce((sum, d) => sum + (d.engagement_rate || 0), 0) / data.length,
        postsPerWeek:
          data.reduce((sum, d) => sum + (d.posts_count || 0), 0) / (data.length / 7),
        avgLikes: data.reduce((sum, d) => sum + (d.avg_likes || 0), 0) / data.length,
        avgComments:
          data.reduce((sum, d) => sum + (d.avg_comments || 0), 0) / data.length,
        avgShares: data.reduce((sum, d) => sum + (d.avg_shares || 0), 0) / data.length,
      };
    } catch (error) {
      logger.error('Failed to get competitor metrics:', { error, competitorId });
      return this.getEmptyMetricSet();
    }
  }

  private getEmptyMetricSet(): MetricSet {
    return {
      followers: 0,
      followersGrowth: 0,
      avgEngagementRate: 0,
      postsPerWeek: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
    };
  }

  private calculateAverageMetrics(metrics: MetricSet[]): MetricSet {
    if (metrics.length === 0) return this.getEmptyMetricSet();

    return {
      followers:
        metrics.reduce((sum, m) => sum + m.followers, 0) / metrics.length,
      followersGrowth:
        metrics.reduce((sum, m) => sum + m.followersGrowth, 0) / metrics.length,
      avgEngagementRate:
        metrics.reduce((sum, m) => sum + m.avgEngagementRate, 0) / metrics.length,
      postsPerWeek:
        metrics.reduce((sum, m) => sum + m.postsPerWeek, 0) / metrics.length,
      avgLikes:
        metrics.reduce((sum, m) => sum + m.avgLikes, 0) / metrics.length,
      avgComments:
        metrics.reduce((sum, m) => sum + m.avgComments, 0) / metrics.length,
      avgShares:
        metrics.reduce((sum, m) => sum + m.avgShares, 0) / metrics.length,
    };
  }

  private findTopPerformer(metrics: MetricSet[]): MetricSet {
    if (metrics.length === 0) return this.getEmptyMetricSet();

    // Use engagement rate as primary ranking
    return metrics.reduce((best, current) =>
      current.avgEngagementRate > best.avgEngagementRate ? current : best
    );
  }

  private findBottomPerformer(metrics: MetricSet[]): MetricSet {
    if (metrics.length === 0) return this.getEmptyMetricSet();

    return metrics.reduce((worst, current) =>
      current.avgEngagementRate < worst.avgEngagementRate ? current : worst
    );
  }

  private calculateRankings(
    userMetrics: MetricSet,
    allMetrics: MetricSet[]
  ): Array<{
    metric: string;
    yourRank: number;
    totalCompetitors: number;
    percentile: number;
  }> {
    const metrics = [
      'followers',
      'followersGrowth',
      'avgEngagementRate',
      'postsPerWeek',
      'avgLikes',
      'avgComments',
      'avgShares',
    ] as const;

    return metrics.map((metric) => {
      const sorted = [...allMetrics].sort(
        (a, b) => b[metric] - a[metric]
      );
      const rank = sorted.findIndex((m) => m === userMetrics) + 1;
      const percentile = ((allMetrics.length - rank) / allMetrics.length) * 100;

      return {
        metric,
        yourRank: rank,
        totalCompetitors: allMetrics.length,
        percentile: Math.round(percentile),
      };
    });
  }

  private identifyGaps(
    userMetrics: MetricSet,
    industryAvg: MetricSet,
    topPerformer: MetricSet
  ): Array<{
    metric: string;
    yourValue: number;
    benchmarkValue: number;
    gap: number;
    gapPercent: number;
    priority: 'high' | 'medium' | 'low';
    recommendations: string[];
  }> {
    const gaps: Array<{
      metric: string;
      yourValue: number;
      benchmarkValue: number;
      gap: number;
      gapPercent: number;
      priority: 'high' | 'medium' | 'low';
      recommendations: string[];
    }> = [];

    const metricConfigs: Record<
      string,
      { benchmark: 'avg' | 'top'; recommendations: string[] }
    > = {
      avgEngagementRate: {
        benchmark: 'avg',
        recommendations: [
          'Improve content quality and relevance',
          'Post at optimal times',
          'Use more engaging formats (video, carousel)',
        ],
      },
      followersGrowth: {
        benchmark: 'top',
        recommendations: [
          'Increase posting frequency',
          'Collaborate with influencers',
          'Run engagement campaigns',
        ],
      },
      postsPerWeek: {
        benchmark: 'avg',
        recommendations: [
          'Develop content calendar',
          'Batch create content',
          'Use scheduling tools',
        ],
      },
    };

    for (const [metric, config] of Object.entries(metricConfigs)) {
      const yourValue = (userMetrics as any)[metric];
      const benchmarkValue =
        config.benchmark === 'avg'
          ? (industryAvg as any)[metric]
          : (topPerformer as any)[metric];

      const gap = benchmarkValue - yourValue;
      const gapPercent =
        benchmarkValue > 0 ? (gap / benchmarkValue) * 100 : 0;

      if (gap > 0) {
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (gapPercent > 50) priority = 'high';
        else if (gapPercent > 25) priority = 'medium';

        gaps.push({
          metric,
          yourValue,
          benchmarkValue,
          gap,
          gapPercent,
          priority,
          recommendations: config.recommendations,
        });
      }
    }

    return gaps.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }

  private async identifyOpportunitiesAndThreats(
    userId: string,
    competitors: Competitor[],
    platforms: Platform[]
  ): Promise<{ opportunities: string[]; threats: string[] }> {
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Analyze content gaps as opportunities
    for (const platform of platforms) {
      const gaps = await this.identifyContentGaps(userId, platform, {
        competitorIds: competitors.map((c) => c.id),
      });

      for (const gap of gaps.filter((g) => g.opportunity === 'high')) {
        opportunities.push(
          `Untapped topic: ${gap.topic} (avg ${gap.avgEngagement.toFixed(1)}% engagement)`
        );
      }
    }

    // Analyze competitor growth as threats
    for (const competitor of competitors) {
      for (const platform of platforms) {
        const profile = await this.getCompetitorProfile(competitor.id, platform);
        if (profile && profile.growthRate.followers > 10) {
          threats.push(
            `${competitor.name} growing rapidly on ${platform} (+${profile.growthRate.followers.toFixed(1)}%)`
          );
        }
      }
    }

    return { opportunities: opportunities.slice(0, 5), threats: threats.slice(0, 5) };
  }

  private async getUserTopics(
    userId: string,
    platform: Platform
  ): Promise<Set<string>> {
    try {
      const { data } = await supabase
        .from('posts')
        .select('themes')
        .eq('user_id', userId)
        .eq('platform', platform)
        .not('themes', 'is', null);

      const topics = new Set<string>();
      for (const post of data || []) {
        for (const theme of post.themes || []) {
          topics.add(theme);
        }
      }

      return topics;
    } catch (error) {
      logger.error('Failed to get user topics:', { error, userId });
      return new Set();
    }
  }

  private calculateTrend(values: number[]): 'rising' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'rising';
    if (change < -10) return 'declining';
    return 'stable';
  }
}

export const competitiveIntel = new CompetitiveIntelligence();
