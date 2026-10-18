/**
 * Self-Optimizing Content Engine
 *
 * @description Automatically optimizes content based on performance data,
 * A/B testing, and engagement patterns
 *
 * DATA STORE: NOT PROVISIONED. Post history lives in `scheduled_posts`, which
 * has no Prisma model. The `ab_tests` model exists but has no content_id,
 * split_ratio or per-variation control/rate columns, so persisting this
 * engine's A/B tests would silently drop data. Every data path throws
 * ContentOptimizerNotProvisionedError instead of faking success.
 */

import { logger } from '@/lib/logger';

/** Thrown when a path needs a table (or columns) that has no Prisma model. */
export class ContentOptimizerNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  constructor(readonly table: string) {
    super(
      `Content optimization is not provisioned: table "${table}" has no matching Prisma model.`
    );
    this.name = 'ContentOptimizerNotProvisionedError';
  }
}

// Optimization types
export type OptimizationType =
  | 'hashtag'
  | 'caption'
  | 'timing'
  | 'format'
  | 'cta'
  | 'emoji'
  | 'length';
export type Platform =
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'youtube';

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

/** A/B Test analysis result */
interface ABTestAnalysis {
  totalImpressions: number;
  avgEngagementRate: number;
  lift: number;
  isSignificant: boolean;
  recommendation: string;
}

class ContentOptimizer {
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();
  private readonly CACHE_TTL = 1800000; // 30 minutes

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

      const emojiSuggestions = this.optimizeEmojis(
        content,
        platform,
        performanceData
      );
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
        return total + s.expectedImprovement * s.confidence * 0.1;
      }, 0);

      return {
        success: true,
        originalContent: content,
        optimizedContent,
        suggestions,
        appliedOptimizations,
        expectedEngagementBoost: Math.min(expectedBoost, 50), // Cap at 50%
      };
    } catch (error: unknown) {
      if (error instanceof ContentOptimizerNotProvisionedError) throw error;
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
    throw new ContentOptimizerNotProvisionedError('ab_tests');
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(
    userId: string,
    testId: string
  ): Promise<(ABTestConfig & { analysis: ABTestAnalysis }) | null> {
    throw new ContentOptimizerNotProvisionedError('ab_tests');
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
  ): Promise<
    Array<{
      postId: string;
      original: string;
      optimized: string;
      suggestions: OptimizationSuggestion[];
      applied: boolean;
    }>
  > {
    throw new ContentOptimizerNotProvisionedError('scheduled_posts');
  }

  /**
   * Get trending hashtags for a platform
   */
  async getTrendingHashtags(
    userId: string,
    platform: Platform,
    category?: string
  ): Promise<HashtagPerformance[]> {
    throw new ContentOptimizerNotProvisionedError('scheduled_posts');
  }

  // ==================== Private Methods ====================

  private async getPerformanceData(
    userId: string,
    platform: Platform
  ): Promise<ContentPerformance[]> {
    throw new ContentOptimizerNotProvisionedError('scheduled_posts');
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
        suggested: [
          ...currentHashtags.slice(0, limit - 3),
          ...unusedTrending.slice(0, 3).map(t => t.hashtag),
        ].join(' '),
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
        reasoning:
          'Questions in captions typically increase comment rate by 20%',
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
        reasoning:
          'Shorter first lines perform better in feeds (truncated preview)',
      });
    }

    return suggestions;
  }

  private optimizeLength(
    content: string,
    platform: Platform
  ): OptimizationSuggestion[] {
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

    const ctaKeywords = [
      'click',
      'link',
      'comment',
      'share',
      'like',
      'follow',
      'subscribe',
      'learn',
      'discover',
      'join',
    ];
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
    const pooledRate =
      (controlRate * controlN + treatmentRate * treatmentN) /
      (controlN + treatmentN);
    const se = Math.sqrt(
      pooledRate * (1 - pooledRate) * (1 / controlN + 1 / treatmentN)
    );

    if (se === 0) return 0;

    const z = Math.abs(treatmentRate - controlRate) / se;

    // Convert Z-score to confidence level (approximation)
    if (z >= 2.576) return 0.99;
    if (z >= 1.96) return 0.95;
    if (z >= 1.645) return 0.9;
    if (z >= 1.28) return 0.8;
    return 0.5 + z * 0.15;
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[\w]+/g);
    return matches || [];
  }
}

// Export singleton
export const contentOptimizer = new ContentOptimizer();
