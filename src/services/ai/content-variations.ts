/**
 * AI Content Variations Service
 *
 * @description Generate content variations for A/B testing:
 * - Tone and style variations
 * - Platform-specific adaptations
 * - Hook and CTA variations
 * - Length variations
 * - Engagement optimization
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns original content if AI fails
 */

import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache/cache-manager';

// ============================================================================
// TYPES
// ============================================================================

export type ToneType =
  | 'professional'
  | 'casual'
  | 'humorous'
  | 'inspirational'
  | 'urgent'
  | 'educational'
  | 'conversational'
  | 'authoritative';

export type ContentLength = 'short' | 'medium' | 'long';

export type PlatformStyle =
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'threads';

export interface VariationConfig {
  /** Original content to vary */
  originalContent: string;
  /** Target platform */
  platform: PlatformStyle;
  /** Number of variations to generate */
  count?: number;
  /** Variation strategies to use */
  strategies?: VariationStrategy[];
  /** Persona to maintain */
  personaId?: string;
  /** Additional context */
  context?: string;
  /** Target audience */
  audience?: string;
  /** Goal of the content */
  goal?: 'engagement' | 'conversion' | 'awareness' | 'education';
}

export type VariationStrategy =
  | 'tone'
  | 'length'
  | 'hook'
  | 'cta'
  | 'emoji'
  | 'hashtag'
  | 'question'
  | 'statistic'
  | 'story';

export interface ContentVariation {
  id: string;
  content: string;
  strategy: VariationStrategy;
  tone: ToneType;
  platform: PlatformStyle;
  metadata: VariationMetadata;
  score: number;
}

export interface VariationMetadata {
  characterCount: number;
  wordCount: number;
  emojiCount: number;
  hashtagCount: number;
  hasQuestion: boolean;
  hasCTA: boolean;
  readabilityScore: number;
  estimatedEngagement: number;
}

export interface ABTestConfig {
  variationIds: string[];
  startDate: Date;
  endDate: Date;
  splitRatio?: number[]; // Default: equal split
  winningMetric: 'engagement' | 'clicks' | 'conversions';
  minimumSampleSize: number;
}

export interface ABTestResult {
  testId: string;
  status: 'running' | 'completed' | 'inconclusive';
  variations: Array<{
    id: string;
    impressions: number;
    engagements: number;
    clicks: number;
    conversions: number;
    engagementRate: number;
    confidence: number;
  }>;
  winner?: string;
  improvement?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_LIMITS: Record<PlatformStyle, { minLength: number; maxLength: number; hashtagLimit: number }> = {
  twitter: { minLength: 20, maxLength: 280, hashtagLimit: 3 },
  instagram: { minLength: 20, maxLength: 2200, hashtagLimit: 30 },
  linkedin: { minLength: 50, maxLength: 3000, hashtagLimit: 5 },
  facebook: { minLength: 20, maxLength: 500, hashtagLimit: 3 },
  tiktok: { minLength: 20, maxLength: 300, hashtagLimit: 5 },
  threads: { minLength: 20, maxLength: 500, hashtagLimit: 5 },
};

const TONE_DESCRIPTORS: Record<ToneType, string> = {
  professional: 'formal, polished, and business-appropriate',
  casual: 'relaxed, friendly, and approachable',
  humorous: 'witty, playful, with light humor',
  inspirational: 'motivating, uplifting, and empowering',
  urgent: 'time-sensitive, action-oriented, and compelling',
  educational: 'informative, clear, and instructive',
  conversational: 'natural, engaging, like talking to a friend',
  authoritative: 'expert, confident, and trustworthy',
};

// ============================================================================
// CONTENT VARIATIONS SERVICE
// ============================================================================

export class ContentVariationsService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  /**
   * Generate content variations
   */
  async generateVariations(config: VariationConfig): Promise<ContentVariation[]> {
    const {
      originalContent,
      platform,
      count = 3,
      strategies = ['tone', 'hook', 'cta'],
      personaId,
      context,
      audience,
      goal = 'engagement',
    } = config;

    const variations: ContentVariation[] = [];
    const platformLimits = PLATFORM_LIMITS[platform];

    try {
      // Generate variations for each strategy
      for (const strategy of strategies) {
        const variation = await this.generateVariation(
          originalContent,
          strategy,
          platform,
          platformLimits,
          { personaId, context, audience, goal }
        );

        if (variation) {
          variations.push(variation);
        }

        if (variations.length >= count) break;
      }

      // If we need more, generate additional tone variations
      while (variations.length < count) {
        const tones: ToneType[] = ['casual', 'professional', 'conversational', 'inspirational'];
        const unusedTone = tones.find(
          t => !variations.some(v => v.tone === t)
        );

        if (!unusedTone) break;

        const variation = await this.generateToneVariation(
          originalContent,
          unusedTone,
          platform,
          platformLimits
        );

        if (variation) {
          variations.push(variation);
        } else {
          break;
        }
      }

      // Score and sort variations
      const scoredVariations = variations.map(v => ({
        ...v,
        score: this.scoreVariation(v, goal),
      }));

      return scoredVariations.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Failed to generate variations', { error });
      return this.generateFallbackVariations(originalContent, platform, count);
    }
  }

  /**
   * Generate a single variation using a specific strategy
   */
  private async generateVariation(
    content: string,
    strategy: VariationStrategy,
    platform: PlatformStyle,
    limits: { minLength: number; maxLength: number; hashtagLimit: number },
    options: { personaId?: string; context?: string; audience?: string; goal?: string }
  ): Promise<ContentVariation | null> {
    const prompt = this.buildVariationPrompt(content, strategy, platform, limits, options);

    try {
      const response = await this.callAI(prompt);
      const generatedContent = this.extractContent(response);

      if (!generatedContent) return null;

      // Validate and adjust content
      const adjustedContent = this.adjustForPlatform(generatedContent, platform, limits);

      return {
        id: this.generateId(),
        content: adjustedContent,
        strategy,
        tone: this.detectTone(adjustedContent),
        platform,
        metadata: this.analyzeContent(adjustedContent),
        score: 0, // Will be scored later
      };
    } catch (error) {
      logger.error('Variation generation failed', { error, strategy });
      return null;
    }
  }

  /**
   * Generate a tone variation
   */
  private async generateToneVariation(
    content: string,
    tone: ToneType,
    platform: PlatformStyle,
    limits: { minLength: number; maxLength: number; hashtagLimit: number }
  ): Promise<ContentVariation | null> {
    const prompt = `Rewrite this content in a ${TONE_DESCRIPTORS[tone]} tone for ${platform}:

Original: "${content}"

Requirements:
- Maximum ${limits.maxLength} characters
- Maximum ${limits.hashtagLimit} hashtags
- Maintain the core message
- Make it native to ${platform}

Rewritten content:`;

    try {
      const response = await this.callAI(prompt);
      const generatedContent = this.extractContent(response);

      if (!generatedContent) return null;

      const adjustedContent = this.adjustForPlatform(generatedContent, platform, limits);

      return {
        id: this.generateId(),
        content: adjustedContent,
        strategy: 'tone',
        tone,
        platform,
        metadata: this.analyzeContent(adjustedContent),
        score: 0,
      };
    } catch (error) {
      logger.error('Tone variation failed', { error, tone });
      return null;
    }
  }

  /**
   * Build variation prompt based on strategy
   */
  private buildVariationPrompt(
    content: string,
    strategy: VariationStrategy,
    platform: PlatformStyle,
    limits: { minLength: number; maxLength: number; hashtagLimit: number },
    options: { personaId?: string; context?: string; audience?: string; goal?: string }
  ): string {
    const strategyInstructions: Record<VariationStrategy, string> = {
      tone: 'Change the tone while keeping the message',
      length: 'Create a shorter/longer version',
      hook: 'Start with a stronger, attention-grabbing hook',
      cta: 'Add or improve the call-to-action',
      emoji: 'Add strategic emojis for engagement',
      hashtag: 'Optimize hashtags for discoverability',
      question: 'Start with an engaging question',
      statistic: 'Lead with a compelling statistic or fact',
      story: 'Frame it as a mini story or narrative',
    };

    return `Create a variation of this content for ${platform}.

Original: "${content}"

Strategy: ${strategyInstructions[strategy]}

${options.audience ? `Target audience: ${options.audience}` : ''}
${options.context ? `Context: ${options.context}` : ''}
${options.goal ? `Goal: ${options.goal}` : ''}

Requirements:
- Maximum ${limits.maxLength} characters
- Maximum ${limits.hashtagLimit} hashtags
- Native to ${platform} style and format
- Engaging and shareable

Variation:`;
  }

  /**
   * Call AI API
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://synthex.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Extract content from AI response
   */
  private extractContent(response: string): string {
    // Clean up the response
    let content = response.trim();

    // Remove common prefixes
    const prefixes = ['Here\'s', 'Here is', 'Variation:', 'Content:'];
    for (const prefix of prefixes) {
      if (content.startsWith(prefix)) {
        content = content.slice(prefix.length).trim();
      }
    }

    // Remove quotes if wrapped
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    return content;
  }

  /**
   * Adjust content for platform limits
   */
  private adjustForPlatform(
    content: string,
    platform: PlatformStyle,
    limits: { minLength: number; maxLength: number; hashtagLimit: number }
  ): string {
    let adjusted = content;

    // Truncate if too long
    if (adjusted.length > limits.maxLength) {
      // Try to truncate at a sentence boundary
      const truncateAt = limits.maxLength - 3;
      const lastPeriod = adjusted.lastIndexOf('.', truncateAt);
      const lastQuestion = adjusted.lastIndexOf('?', truncateAt);
      const lastExclaim = adjusted.lastIndexOf('!', truncateAt);

      const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);

      if (breakPoint > limits.maxLength * 0.7) {
        adjusted = adjusted.slice(0, breakPoint + 1);
      } else {
        adjusted = adjusted.slice(0, truncateAt) + '...';
      }
    }

    // Limit hashtags
    const hashtags = adjusted.match(/#\w+/g) || [];
    if (hashtags.length > limits.hashtagLimit) {
      const excessHashtags = hashtags.slice(limits.hashtagLimit);
      for (const tag of excessHashtags) {
        adjusted = adjusted.replace(tag, '').trim();
      }
    }

    return adjusted.trim();
  }

  /**
   * Detect tone of content
   */
  private detectTone(content: string): ToneType {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('!') && (lowerContent.includes('now') || lowerContent.includes('limited'))) {
      return 'urgent';
    }
    if (lowerContent.includes('😂') || lowerContent.includes('lol') || lowerContent.includes('haha')) {
      return 'humorous';
    }
    if (lowerContent.includes('learn') || lowerContent.includes('tip') || lowerContent.includes('guide')) {
      return 'educational';
    }
    if (lowerContent.includes('dream') || lowerContent.includes('achieve') || lowerContent.includes('believe')) {
      return 'inspirational';
    }
    if (lowerContent.includes('data shows') || lowerContent.includes('research') || lowerContent.includes('expert')) {
      return 'authoritative';
    }
    if (content.includes('?') || lowerContent.includes('what do you think')) {
      return 'conversational';
    }

    // Check formality
    const informalIndicators = ['hey', 'guys', 'awesome', 'cool', '!'];
    const formalIndicators = ['therefore', 'furthermore', 'regarding', 'pleased'];

    const informalScore = informalIndicators.filter(i => lowerContent.includes(i)).length;
    const formalScore = formalIndicators.filter(i => lowerContent.includes(i)).length;

    if (formalScore > informalScore) return 'professional';
    if (informalScore > formalScore) return 'casual';

    return 'conversational';
  }

  /**
   * Analyze content metadata
   */
  private analyzeContent(content: string): VariationMetadata {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const emojis = content.match(/[\p{Emoji}]/gu) || [];
    const hashtags = content.match(/#\w+/g) || [];

    return {
      characterCount: content.length,
      wordCount: words.length,
      emojiCount: emojis.length,
      hashtagCount: hashtags.length,
      hasQuestion: content.includes('?'),
      hasCTA: this.hasCTA(content),
      readabilityScore: this.calculateReadability(content),
      estimatedEngagement: this.estimateEngagement(content),
    };
  }

  /**
   * Check if content has a call-to-action
   */
  private hasCTA(content: string): boolean {
    const ctaPatterns = [
      /click|tap|swipe/i,
      /learn more/i,
      /sign up/i,
      /get started/i,
      /join/i,
      /subscribe/i,
      /follow/i,
      /link in bio/i,
      /check out/i,
      /comment below/i,
      /share your/i,
    ];

    return ctaPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculate readability score (simplified Flesch-Kincaid)
   */
  private calculateReadability(content: string): number {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (words.length === 0 || sentences.length === 0) return 50;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length;

    // Simplified Flesch Reading Ease
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count syllables in a word (simplified)
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    const vowels = word.match(/[aeiouy]+/g) || [];
    let count = vowels.length;

    // Adjust for silent e
    if (word.endsWith('e')) count--;

    return Math.max(1, count);
  }

  /**
   * Estimate engagement potential (0-100)
   */
  private estimateEngagement(content: string): number {
    let score = 50; // Base score

    // Boost for questions
    if (content.includes('?')) score += 10;

    // Boost for emojis (up to a point)
    const emojiCount = (content.match(/[\p{Emoji}]/gu) || []).length;
    score += Math.min(15, emojiCount * 5);

    // Boost for hashtags (moderate)
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    score += Math.min(10, hashtagCount * 3);

    // Boost for CTA
    if (this.hasCTA(content)) score += 10;

    // Penalty for being too long
    if (content.length > 500) score -= 10;

    // Boost for starting with a hook
    const hookStarters = ['Did you know', 'What if', 'Imagine', 'The secret', 'Here\'s why'];
    if (hookStarters.some(h => content.toLowerCase().startsWith(h.toLowerCase()))) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score variation based on goal
   */
  private scoreVariation(variation: ContentVariation, goal: string): number {
    const { metadata } = variation;
    let score = metadata.estimatedEngagement;

    switch (goal) {
      case 'engagement':
        if (metadata.hasQuestion) score += 10;
        if (metadata.emojiCount > 0) score += 5;
        break;
      case 'conversion':
        if (metadata.hasCTA) score += 20;
        if (variation.tone === 'urgent') score += 10;
        break;
      case 'awareness':
        if (metadata.hashtagCount > 0) score += 10;
        if (metadata.characterCount > 100) score += 5;
        break;
      case 'education':
        if (variation.tone === 'educational') score += 15;
        if (metadata.readabilityScore > 60) score += 10;
        break;
    }

    return Math.min(100, score);
  }

  /**
   * When AI is unavailable, return an empty array.
   * Simple string manipulation (adding prefixes, truncating) does not produce
   * genuine content variations and should not silently substitute for AI output.
   */
  private generateFallbackVariations(
    _content: string,
    _platform: PlatformStyle,
    _count: number
  ): ContentVariation[] {
    logger.warn('Content variation generation failed: AI service unavailable. No fallback variations generated.');
    return [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `var_${randomUUID()}`;
  }
}

// ============================================================================
// A/B TEST SERVICE
// ============================================================================

export class ABTestService {
  /**
   * Create an A/B test for variations
   */
  static async createTest(
    organizationId: string,
    config: ABTestConfig
  ): Promise<{ testId: string; status: string }> {
    const testId = `abt_${randomUUID()}`;

    const cache = getCache();
    await cache.set(
      `abtest:${testId}`,
      {
        id: testId,
        organizationId,
        config,
        status: 'running',
        createdAt: new Date(),
        results: config.variationIds.map(id => ({
          variationId: id,
          impressions: 0,
          engagements: 0,
          clicks: 0,
          conversions: 0,
        })),
      },
      { ttl: 86400 * 30 } // 30 days
    );

    logger.info('A/B test created', { testId, organizationId });

    return { testId, status: 'running' };
  }

  /**
   * Record an event for A/B test
   */
  static async recordEvent(
    testId: string,
    variationId: string,
    eventType: 'impression' | 'engagement' | 'click' | 'conversion'
  ): Promise<void> {
    const cache = getCache();
    const test = await cache.get<{
      results: Array<{
        variationId: string;
        impressions: number;
        engagements: number;
        clicks: number;
        conversions: number;
      }>;
    }>(`abtest:${testId}`);

    if (!test) return;

    const variation = test.results.find(r => r.variationId === variationId);
    if (!variation) return;

    switch (eventType) {
      case 'impression':
        variation.impressions++;
        break;
      case 'engagement':
        variation.engagements++;
        break;
      case 'click':
        variation.clicks++;
        break;
      case 'conversion':
        variation.conversions++;
        break;
    }

    await cache.set(`abtest:${testId}`, test, { ttl: 86400 * 30 });
  }

  /**
   * Get A/B test results
   */
  static async getResults(testId: string): Promise<ABTestResult | null> {
    const cache = getCache();
    const test = await cache.get<{
      id: string;
      config: ABTestConfig;
      status: string;
      results: Array<{
        variationId: string;
        impressions: number;
        engagements: number;
        clicks: number;
        conversions: number;
      }>;
    }>(`abtest:${testId}`);

    if (!test) return null;

    const variations = test.results.map(r => ({
      id: r.variationId,
      impressions: r.impressions,
      engagements: r.engagements,
      clicks: r.clicks,
      conversions: r.conversions,
      engagementRate: r.impressions > 0 ? (r.engagements / r.impressions) * 100 : 0,
      confidence: this.calculateConfidence(r.impressions, r.engagements),
    }));

    // Determine winner
    const metricKey = test.config.winningMetric;
    const sorted = [...variations].sort((a, b) => {
      const aValue = metricKey === 'engagement' ? a.engagementRate : a[metricKey + 's' as keyof typeof a];
      const bValue = metricKey === 'engagement' ? b.engagementRate : b[metricKey + 's' as keyof typeof b];
      return (bValue as number) - (aValue as number);
    });

    const hasEnoughData = variations.every(
      v => v.impressions >= test.config.minimumSampleSize
    );

    const winner = hasEnoughData && sorted[0].confidence > 95 ? sorted[0].id : undefined;

    return {
      testId: test.id,
      status: winner ? 'completed' : hasEnoughData ? 'inconclusive' : 'running',
      variations,
      winner,
      improvement: winner && sorted.length > 1
        ? ((sorted[0].engagementRate - sorted[1].engagementRate) / sorted[1].engagementRate) * 100
        : undefined,
    };
  }

  /**
   * Calculate statistical confidence (simplified)
   */
  private static calculateConfidence(impressions: number, conversions: number): number {
    if (impressions < 100) return 0;

    const rate = conversions / impressions;
    const standardError = Math.sqrt((rate * (1 - rate)) / impressions);
    const zScore = rate / standardError;

    // Simplified confidence from z-score
    if (zScore > 2.576) return 99;
    if (zScore > 1.96) return 95;
    if (zScore > 1.645) return 90;
    if (zScore > 1.282) return 80;

    return Math.min(80, Math.round(zScore * 40));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ContentVariationsService as default };
