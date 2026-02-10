/**
 * Self-Optimizing Content Engine
 *
 * @description Automatically optimizes content based on performance data,
 * A/B testing, and engagement patterns
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 * - OPENROUTER_API_KEY: OpenRouter API key for AI enhancements (SECRET)
 *
 * FAILURE MODE: Returns original content if optimization fails
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Optimization types
export type OptimizationType = 'hashtag' | 'caption' | 'timing' | 'format' | 'cta' | 'emoji' | 'length';
export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok' | 'youtube';

// Content performance metrics
export interface ContentPerformance {
  impressions: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  reach: number;
}

// A/B Test configuration
export interface ABTestConfig {
  id: string;
  name: string;
  contentId: string;
  variations: ABVariation[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  winningVariation?: string;
  statisticalSignificance?: number;
}

export interface ABVariation {
  id: string;
  name: string;
  content: string;
  hashtags?: string[];
  mediaUrl?: string;
  impressions: number;
  engagementRate: number;
  conversionRate: number;
  isControl: boolean;
}

// Optimization suggestion
export interface OptimizationSuggestion {
  type: OptimizationType;
  priority: 'high' | 'medium' | 'low';
  original: string;
  suggested: string;
  expectedImprovement: number; // percentage
  confidence: number; // 0-1
  reasoning: string;
}

// Optimization result
export interface OptimizationResult {
  success: boolean;
  originalContent: string;
  optimizedContent: string;
  suggestions: OptimizationSuggestion[];
  appliedOptimizations: OptimizationType[];
  expectedEngagementBoost: number;
}

// Hashtag performance data
interface HashtagPerformance {
  hashtag: string;
  avgEngagementRate: number;
  avgReach: number;
  usageCount: number;
  trendingScore: number;
}

class ContentOptimizer {
  private supabase: SupabaseClient;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 1800000; // 30 minutes

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Optimize content for a specific platform
   */
  async optimizeContent(
    userId: string,
    content: string,
    platform: Platform,
    options: {
      hashtags?: string[];
      mediaType?: 'image' | 'video' | 'carousel';
      targetAudience?: string;
      goal?: 'engagement' | 'reach' | 'conversions' | 'brand';
    } = {}
  ): Promise<OptimizationResult> {
    const suggestions: OptimizationSuggestion[] = [];
    let optimizedContent = content;

    try {
      // Get user's historical performance data
      const performanceData = await this.getPerformanceData(userId, platform);

      // Analyze and suggest optimizations
      const hashtagSuggestions = await this.optimizeHashtags(
        userId,
        options.hashtags || [],
        platform,
        performanceData
      );
      suggestions.push(...hashtagSuggestions);

      const captionSuggestions = this.optimizeCaption(
        content,
        platform,
        performanceData
      );
      suggestions.push(...captionSuggestions);

      const lengthSuggestions = this.optimizeLength(content, platform);
      suggestions.push(...lengthSuggestions);

      const emojiSuggestions = this.optimizeEmojis(content, platform, performanceData);
      suggestions.push(...emojiSuggestions);

      const ctaSuggestions = this.optimizeCTA(content, platform, options.goal);
      suggestions.push(...ctaSuggestions);

      // Apply high-priority suggestions automatically
      const appliedOptimizations: OptimizationType[] = [];
      for (const suggestion of suggestions) {
        if (suggestion.priority === 'high' && suggestion.confidence >= 0.7) {
          optimizedContent = optimizedContent.replace(
            suggestion.original,
            suggestion.suggested
          );
          appliedOptimizations.push(suggestion.type);
        }
      }

      // Calculate expected boost
      const expectedBoost = suggestions.reduce((total, s) => {
        return total + (s.expectedImprovement * s.confidence * 0.1);
      }, 0);

      return {
        success: true,
        originalContent: content,
        optimizedContent,
        suggestions,
        appliedOptimizations,
        expectedEngagementBoost: Math.min(expectedBoost, 50), // Cap at 50%
      };
    } catch (error: any) {
      logger.error('Content optimization failed:', { error, userId });
      return {
        success: false,
        originalContent: content,
        optimizedContent: content,
        suggestions: [],
        appliedOptimizations: [],
        expectedEngagementBoost: 0,
      };
    }
  }

  /**
   * Create an A/B test for content
   */
  async createABTest(
    userId: string,
    contentId: string,
    variations: Array<{
      name: string;
      content: string;
      hashtags?: string[];
      isControl?: boolean;
    }>,
    config: {
      name: string;
      durationDays?: number;
      splitRatio?: number[]; // e.g., [50, 50] for equal split
    }
  ): Promise<ABTestConfig> {
    const testId = `ab_${Date.now()}`;
    const startDate = new Date();
    const endDate = config.durationDays
      ? new Date(startDate.getTime() + config.durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    const abVariations: ABVariation[] = variations.map((v, i) => ({
      id: `var_${i}`,
      name: v.name,
      content: v.content,
      hashtags: v.hashtags,
      impressions: 0,
      engagementRate: 0,
      conversionRate: 0,
      isControl: v.isControl || i === 0,
    }));

    const test: ABTestConfig = {
      id: testId,
      name: config.name,
      contentId,
      variations: abVariations,
      status: 'draft',
      startDate,
      endDate,
    };

    // Save to database
    await this.supabase.from('ab_tests').insert({
      id: testId,
      user_id: userId,
      content_id: contentId,
      name: config.name,
      variations: abVariations,
      status: 'draft',
      split_ratio: config.splitRatio || [50, 50],
      start_date: startDate.toISOString(),
      end_date: endDate?.toISOString(),
      created_at: new Date().toISOString(),
    });

    return test;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(
    userId: string,
    testId: string
  ): Promise<ABTestConfig & { analysis: any } | null> {
    const { data: test, error } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .eq('user_id', userId)
      .single();

    if (error || !test) {
      return null;
    }

    // Calculate statistical significance
    const variations = test.variations as ABVariation[];
    const control = variations.find(v => v.isControl);
    const treatments = variations.filter(v => !v.isControl);

    let winningVariation: string | undefined;
    let highestLift = 0;
    let significance = 0;

    if (control && control.impressions > 100) {
      for (const treatment of treatments) {
        if (treatment.impressions < 100) continue;

        const lift = ((treatment.engagementRate - control.engagementRate) / control.engagementRate) * 100;
        const sig = this.calculateStatisticalSignificance(
          control.impressions,
          control.engagementRate,
          treatment.impressions,
          treatment.engagementRate
        );

        if (lift > highestLift && sig >= 0.95) {
          highestLift = lift;
          winningVariation = treatment.id;
          significance = sig;
        }
      }
    }

    const result = {
      ...test,
      variations,
      status: test.status,
      startDate: new Date(test.start_date),
      endDate: test.end_date ? new Date(test.end_date) : undefined,
      winningVariation,
      statisticalSignificance: significance,
      analysis: {
        totalImpressions: variations.reduce((sum, v) => sum + v.impressions, 0),
        avgEngagementRate: variations.reduce((sum, v) => sum + v.engagementRate, 0) / variations.length,
        lift: highestLift,
        isSignificant: significance >= 0.95,
        recommendation: winningVariation
          ? `Variation "${variations.find(v => v.id === winningVariation)?.name}" outperforms control by ${highestLift.toFixed(1)}%`
          : 'Not enough data or no significant winner yet',
      },
    };

    return result;
  }

  /**
   * Auto-optimize underperforming content
   */
  async autoOptimizeUnderperformers(
    userId: string,
    platform: Platform,
    options: {
      performanceThreshold?: number; // Below this engagement rate
      maxToOptimize?: number;
      autoApply?: boolean;
    } = {}
  ): Promise<Array<{
    postId: string;
    original: string;
    optimized: string;
    suggestions: OptimizationSuggestion[];
    applied: boolean;
  }>> {
    const threshold = options.performanceThreshold || 0.02; // 2% default
    const maxOptimize = options.maxToOptimize || 10;

    // Find underperforming posts
    const { data: posts } = await this.supabase
      .from('scheduled_posts')
      .select('id, content, hashtags, analytics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(100);

    if (!posts) return [];

    const underperformers = posts.filter(post => {
      const analytics = post.analytics || {};
      const impressions = analytics.impressions || 1;
      const engagements = (analytics.likes || 0) + (analytics.comments || 0);
      return (engagements / impressions) < threshold;
    }).slice(0, maxOptimize);

    const results = [];

    for (const post of underperformers) {
      const optimization = await this.optimizeContent(
        userId,
        post.content,
        platform,
        { hashtags: post.hashtags }
      );

      const result = {
        postId: post.id,
        original: post.content,
        optimized: optimization.optimizedContent,
        suggestions: optimization.suggestions,
        applied: false,
      };

      if (options.autoApply && optimization.success) {
        // Create a new optimized version as a draft
        await this.supabase.from('scheduled_posts').insert({
          user_id: userId,
          platform,
          content: optimization.optimizedContent,
          hashtags: this.extractHashtags(optimization.optimizedContent),
          status: 'draft',
          parent_post_id: post.id,
          optimization_metadata: {
            optimized_from: post.id,
            suggestions: optimization.suggestions,
            expected_boost: optimization.expectedEngagementBoost,
          },
          created_at: new Date().toISOString(),
        });
        result.applied = true;
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Get trending hashtags for a platform
   */
  async getTrendingHashtags(
    userId: string,
    platform: Platform,
    category?: string
  ): Promise<HashtagPerformance[]> {
    const cacheKey = `trending-${platform}-${category || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Get hashtag performance from historical data
    const { data: posts } = await this.supabase
      .from('scheduled_posts')
      .select('hashtags, analytics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!posts) return [];

    const hashtagStats: Map<string, { total: number; engagementSum: number; reachSum: number }> = new Map();

    posts.forEach(post => {
      const hashtags = post.hashtags || [];
      const analytics = post.analytics || {};
      const impressions = analytics.impressions || 1;
      const engagements = (analytics.likes || 0) + (analytics.comments || 0);
      const engagementRate = engagements / impressions;
      const reach = analytics.reach || impressions;

      hashtags.forEach((tag: string) => {
        const existing = hashtagStats.get(tag) || { total: 0, engagementSum: 0, reachSum: 0 };
        hashtagStats.set(tag, {
          total: existing.total + 1,
          engagementSum: existing.engagementSum + engagementRate,
          reachSum: existing.reachSum + reach,
        });
      });
    });

    const trending: HashtagPerformance[] = Array.from(hashtagStats.entries())
      .map(([hashtag, stats]) => ({
        hashtag,
        avgEngagementRate: stats.engagementSum / stats.total,
        avgReach: stats.reachSum / stats.total,
        usageCount: stats.total,
        trendingScore: (stats.engagementSum / stats.total) * Math.log(stats.total + 1) * 100,
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 30);

    this.cache.set(cacheKey, { data: trending, expiry: Date.now() + this.CACHE_TTL });

    return trending;
  }

  // ==================== Private Methods ====================

  private async getPerformanceData(
    userId: string,
    platform: Platform
  ): Promise<ContentPerformance[]> {
    const { data: posts } = await this.supabase
      .from('scheduled_posts')
      .select('analytics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (!posts) return [];

    return posts.map(post => {
      const a = post.analytics || {};
      const impressions = a.impressions || 1;
      return {
        impressions,
        engagementRate: ((a.likes || 0) + (a.comments || 0) + (a.shares || 0)) / impressions,
        likes: a.likes || 0,
        comments: a.comments || 0,
        shares: a.shares || 0,
        saves: a.saves || 0,
        clicks: a.clicks || 0,
        reach: a.reach || impressions,
      };
    });
  }

  private async optimizeHashtags(
    userId: string,
    currentHashtags: string[],
    platform: Platform,
    performanceData: ContentPerformance[]
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const trending = await this.getTrendingHashtags(userId, platform);

    // Platform-specific hashtag limits
    const limits: Record<Platform, number> = {
      twitter: 3,
      instagram: 30,
      linkedin: 5,
      facebook: 5,
      tiktok: 5,
      youtube: 15,
    };

    const limit = limits[platform];

    // Suggest trending hashtags not currently used
    const unusedTrending = trending
      .filter(t => !currentHashtags.includes(t.hashtag))
      .slice(0, 5);

    if (unusedTrending.length > 0) {
      suggestions.push({
        type: 'hashtag',
        priority: 'high',
        original: currentHashtags.join(' '),
        suggested: [...currentHashtags.slice(0, limit - 3), ...unusedTrending.slice(0, 3).map(t => t.hashtag)].join(' '),
        expectedImprovement: 15,
        confidence: 0.7,
        reasoning: `Adding trending hashtags like ${unusedTrending[0].hashtag} could increase reach by ~15%`,
      });
    }

    // Suggest removing low-performing hashtags
    if (currentHashtags.length > limit) {
      suggestions.push({
        type: 'hashtag',
        priority: 'medium',
        original: currentHashtags.join(' '),
        suggested: currentHashtags.slice(0, limit).join(' '),
        expectedImprovement: 5,
        confidence: 0.8,
        reasoning: `Reducing to ${limit} hashtags is optimal for ${platform}`,
      });
    }

    return suggestions;
  }

  private optimizeCaption(
    content: string,
    platform: Platform,
    performanceData: ContentPerformance[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for question (increases engagement)
    if (!content.includes('?') && content.length > 50) {
      suggestions.push({
        type: 'caption',
        priority: 'medium',
        original: content,
        suggested: content + '\n\nWhat do you think? 👇',
        expectedImprovement: 20,
        confidence: 0.6,
        reasoning: 'Questions in captions typically increase comment rate by 20%',
      });
    }

    // Check for first line hook
    const firstLine = content.split('\n')[0];
    if (firstLine.length > 100) {
      suggestions.push({
        type: 'caption',
        priority: 'high',
        original: firstLine,
        suggested: firstLine.substring(0, 80) + '...',
        expectedImprovement: 10,
        confidence: 0.7,
        reasoning: 'Shorter first lines perform better in feeds (truncated preview)',
      });
    }

    return suggestions;
  }

  private optimizeLength(content: string, platform: Platform): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Optimal lengths by platform
    const optimalLengths: Record<Platform, { min: number; max: number }> = {
      twitter: { min: 71, max: 100 },
      instagram: { min: 138, max: 150 },
      linkedin: { min: 150, max: 300 },
      facebook: { min: 40, max: 80 },
      tiktok: { min: 50, max: 100 },
      youtube: { min: 200, max: 500 },
    };

    const optimal = optimalLengths[platform];
    const length = content.length;

    if (length < optimal.min) {
      suggestions.push({
        type: 'length',
        priority: 'low',
        original: `${length} characters`,
        suggested: `${optimal.min}-${optimal.max} characters`,
        expectedImprovement: 5,
        confidence: 0.5,
        reasoning: `Content may be too short for ${platform}. Consider adding context.`,
      });
    } else if (length > optimal.max * 2) {
      suggestions.push({
        type: 'length',
        priority: 'medium',
        original: `${length} characters`,
        suggested: `${optimal.min}-${optimal.max} characters`,
        expectedImprovement: 10,
        confidence: 0.6,
        reasoning: `Content may be too long for ${platform}. Consider condensing.`,
      });
    }

    return suggestions;
  }

  private optimizeEmojis(
    content: string,
    platform: Platform,
    performanceData: ContentPerformance[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;

    // Platform-specific emoji recommendations
    const emojiGuidelines: Record<Platform, { min: number; max: number }> = {
      twitter: { min: 1, max: 3 },
      instagram: { min: 2, max: 5 },
      linkedin: { min: 0, max: 2 },
      facebook: { min: 1, max: 3 },
      tiktok: { min: 2, max: 5 },
      youtube: { min: 1, max: 3 },
    };

    const guideline = emojiGuidelines[platform];

    if (emojiCount < guideline.min) {
      suggestions.push({
        type: 'emoji',
        priority: 'low',
        original: `${emojiCount} emojis`,
        suggested: `${guideline.min}-${guideline.max} emojis`,
        expectedImprovement: 8,
        confidence: 0.5,
        reasoning: `Adding emojis can increase engagement on ${platform}`,
      });
    } else if (emojiCount > guideline.max) {
      suggestions.push({
        type: 'emoji',
        priority: 'low',
        original: `${emojiCount} emojis`,
        suggested: `${guideline.min}-${guideline.max} emojis`,
        expectedImprovement: 5,
        confidence: 0.5,
        reasoning: `Too many emojis may appear unprofessional on ${platform}`,
      });
    }

    return suggestions;
  }

  private optimizeCTA(
    content: string,
    platform: Platform,
    goal?: 'engagement' | 'reach' | 'conversions' | 'brand'
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    const ctaKeywords = ['click', 'link', 'comment', 'share', 'like', 'follow', 'subscribe', 'learn', 'discover', 'join'];
    const hasCTA = ctaKeywords.some(kw => content.toLowerCase().includes(kw));

    if (!hasCTA && goal === 'conversions') {
      suggestions.push({
        type: 'cta',
        priority: 'high',
        original: content,
        suggested: content + '\n\n👉 Link in bio to learn more!',
        expectedImprovement: 25,
        confidence: 0.7,
        reasoning: 'Posts with clear CTAs drive 25% more conversions',
      });
    } else if (!hasCTA && goal === 'engagement') {
      suggestions.push({
        type: 'cta',
        priority: 'medium',
        original: content,
        suggested: content + '\n\n💬 Share your thoughts below!',
        expectedImprovement: 15,
        confidence: 0.6,
        reasoning: 'Engagement CTAs can increase comment rate by 15%',
      });
    }

    return suggestions;
  }

  private calculateStatisticalSignificance(
    controlN: number,
    controlRate: number,
    treatmentN: number,
    treatmentRate: number
  ): number {
    // Simplified Z-test for proportions
    const pooledRate = (controlRate * controlN + treatmentRate * treatmentN) / (controlN + treatmentN);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/controlN + 1/treatmentN));

    if (se === 0) return 0;

    const z = Math.abs(treatmentRate - controlRate) / se;

    // Convert Z-score to confidence level (approximation)
    if (z >= 2.576) return 0.99;
    if (z >= 1.96) return 0.95;
    if (z >= 1.645) return 0.90;
    if (z >= 1.28) return 0.80;
    return 0.5 + (z * 0.15);
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w]+/g);
    return matches || [];
  }
}

// Export singleton
export const contentOptimizer = new ContentOptimizer();
