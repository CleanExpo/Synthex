/**
 * AI Quality Feedback Loop
 *
 * @description Learning system that improves content quality based on:
 * - User edit patterns and preferences
 * - Engagement metrics correlation
 * - A/B test results
 * - Explicit feedback signals
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: For storing feedback data (CRITICAL)
 *
 * FAILURE MODE: Continues without learning, logs errors
 */

import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache/cache-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface EditDiff {
  type: 'addition' | 'deletion' | 'replacement';
  original: string;
  edited: string;
  position: number;
  category: 'tone' | 'length' | 'structure' | 'vocabulary' | 'formatting' | 'other';
}

export interface UserPreferences {
  userId: string;
  preferredTone: string[];
  avoidedTone: string[];
  preferredLength: 'short' | 'medium' | 'long';
  vocabularyLevel: 'simple' | 'standard' | 'technical';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtagPreference: number; // 0-10 hashtags
  editPatterns: EditPattern[];
  lastUpdated: Date;
}

export interface EditPattern {
  pattern: string;
  frequency: number;
  lastSeen: Date;
}

export interface QualityWeights {
  engagement: number;
  readability: number;
  relevance: number;
  originality: number;
  formatting: number;
}

export interface ContentVariant {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ExperimentResult {
  variantId: string;
  engagementScore: number;
  clickRate: number;
  shareRate: number;
  conversionRate: number;
  sampleSize: number;
  confidence: number;
  isWinner: boolean;
}

export interface FeedbackSignal {
  type: 'explicit' | 'implicit';
  signal: 'positive' | 'negative' | 'neutral';
  source: 'edit' | 'engagement' | 'rating' | 'usage';
  weight: number;
  context?: Record<string, unknown>;
}

// ============================================================================
// QUALITY FEEDBACK LOOP
// ============================================================================

export class QualityFeedbackLoop {
  private static qualityWeights: QualityWeights = {
    engagement: 0.3,
    readability: 0.2,
    relevance: 0.25,
    originality: 0.15,
    formatting: 0.1,
  };

  /**
   * Learn from user edits to improve future content
   */
  static async learnFromEdit(
    originalContent: string,
    editedContent: string,
    userId: string
  ): Promise<void> {
    try {
      // Analyze the differences
      const diffs = this.analyzeDiff(originalContent, editedContent);

      if (diffs.length === 0) {
        logger.debug('No significant edits detected');
        return;
      }

      // Update user preferences based on edits
      await this.updatePreferences(userId, diffs);

      // Adjust quality weights
      await this.adjustQualityWeights(diffs);

      logger.info('Learned from user edit', {
        userId,
        diffCount: diffs.length,
        categories: [...new Set(diffs.map(d => d.category))],
      });
    } catch (error) {
      logger.error('Failed to learn from edit', { userId, error });
    }
  }

  /**
   * Analyze differences between original and edited content
   */
  private static analyzeDiff(original: string, edited: string): EditDiff[] {
    const diffs: EditDiff[] = [];

    // Simple word-level diff analysis
    const originalWords = original.split(/\s+/);
    const editedWords = edited.split(/\s+/);

    // Length difference analysis
    if (Math.abs(originalWords.length - editedWords.length) > 5) {
      diffs.push({
        type: editedWords.length > originalWords.length ? 'addition' : 'deletion',
        original: original.slice(0, 100),
        edited: edited.slice(0, 100),
        position: 0,
        category: 'length',
      });
    }

    // Tone analysis
    const originalTone = this.detectTone(original);
    const editedTone = this.detectTone(edited);
    if (originalTone !== editedTone) {
      diffs.push({
        type: 'replacement',
        original: originalTone,
        edited: editedTone,
        position: 0,
        category: 'tone',
      });
    }

    // Emoji analysis
    const originalEmojis = (original.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    const editedEmojis = (edited.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (originalEmojis !== editedEmojis) {
      diffs.push({
        type: editedEmojis > originalEmojis ? 'addition' : 'deletion',
        original: `${originalEmojis} emojis`,
        edited: `${editedEmojis} emojis`,
        position: 0,
        category: 'formatting',
      });
    }

    // Hashtag analysis
    const originalHashtags = (original.match(/#\w+/g) || []).length;
    const editedHashtags = (edited.match(/#\w+/g) || []).length;
    if (originalHashtags !== editedHashtags) {
      diffs.push({
        type: editedHashtags > originalHashtags ? 'addition' : 'deletion',
        original: `${originalHashtags} hashtags`,
        edited: `${editedHashtags} hashtags`,
        position: 0,
        category: 'formatting',
      });
    }

    return diffs;
  }

  /**
   * Detect the tone of content
   */
  private static detectTone(content: string): string {
    const lowercase = content.toLowerCase();

    // Simple rule-based tone detection
    if (content.includes('!') && /amazing|incredible|awesome/i.test(content)) {
      return 'enthusiastic';
    }
    if (/data|research|studies show|according to/i.test(content)) {
      return 'professional';
    }
    if (/lol|haha|😂|🤣/i.test(content)) {
      return 'humorous';
    }
    if (/believe in|you can|dream|inspire/i.test(content)) {
      return 'inspirational';
    }
    if (/step|first|next|how to|guide/i.test(content)) {
      return 'educational';
    }

    return 'neutral';
  }

  /**
   * Update user preferences based on edit patterns
   */
  private static async updatePreferences(
    userId: string,
    diffs: EditDiff[]
  ): Promise<void> {
    const cache = getCache();
    const prefsKey = `user:${userId}:preferences`;

    // Get existing preferences
    let prefs = await cache.get<UserPreferences>(prefsKey);

    if (!prefs) {
      prefs = {
        userId,
        preferredTone: [],
        avoidedTone: [],
        preferredLength: 'medium',
        vocabularyLevel: 'standard',
        emojiUsage: 'moderate',
        hashtagPreference: 5,
        editPatterns: [],
        lastUpdated: new Date(),
      };
    }

    // Update based on diffs
    for (const diff of diffs) {
      switch (diff.category) {
        case 'tone':
          if (diff.type === 'replacement') {
            // User prefers the new tone
            if (!prefs.preferredTone.includes(diff.edited)) {
              prefs.preferredTone.push(diff.edited);
            }
            // User avoided the original tone
            if (!prefs.avoidedTone.includes(diff.original)) {
              prefs.avoidedTone.push(diff.original);
            }
          }
          break;

        case 'length':
          if (diff.type === 'deletion') {
            prefs.preferredLength = prefs.preferredLength === 'long' ? 'medium' : 'short';
          } else if (diff.type === 'addition') {
            prefs.preferredLength = prefs.preferredLength === 'short' ? 'medium' : 'long';
          }
          break;

        case 'formatting':
          if (diff.original.includes('emojis')) {
            const emojiChange = parseInt(diff.edited) - parseInt(diff.original);
            prefs.emojiUsage = emojiChange > 0 ? 'heavy' :
              emojiChange < 0 ? 'minimal' : prefs.emojiUsage;
          }
          if (diff.original.includes('hashtags')) {
            const hashtagChange = parseInt(diff.edited) - parseInt(diff.original);
            prefs.hashtagPreference = Math.max(0, Math.min(10,
              prefs.hashtagPreference + Math.sign(hashtagChange) * 2
            ));
          }
          break;
      }

      // Track pattern
      const patternKey = `${diff.category}:${diff.type}`;
      const existingPattern = prefs.editPatterns.find(p => p.pattern === patternKey);
      if (existingPattern) {
        existingPattern.frequency++;
        existingPattern.lastSeen = new Date();
      } else {
        prefs.editPatterns.push({
          pattern: patternKey,
          frequency: 1,
          lastSeen: new Date(),
        });
      }
    }

    prefs.lastUpdated = new Date();

    // Save updated preferences
    await cache.set(prefsKey, prefs, { ttl: 86400 * 30 }); // 30 days
  }

  /**
   * Adjust quality scoring weights based on feedback
   */
  private static async adjustQualityWeights(diffs: EditDiff[]): Promise<void> {
    // Gradual weight adjustment based on edit patterns
    const adjustmentFactor = 0.01; // Small adjustments

    for (const diff of diffs) {
      switch (diff.category) {
        case 'tone':
        case 'vocabulary':
          // Edits to tone/vocabulary suggest relevance matters
          this.qualityWeights.relevance += adjustmentFactor;
          break;

        case 'length':
          // Length edits suggest readability matters
          this.qualityWeights.readability += adjustmentFactor;
          break;

        case 'formatting':
          // Formatting edits directly affect that weight
          this.qualityWeights.formatting += adjustmentFactor;
          break;
      }
    }

    // Normalize weights to sum to 1
    const sum = Object.values(this.qualityWeights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(this.qualityWeights) as Array<keyof QualityWeights>) {
      this.qualityWeights[key] /= sum;
    }
  }

  /**
   * Run A/B test for content quality
   */
  static async runQualityExperiment(
    contentId: string,
    variants: ContentVariant[]
  ): Promise<ExperimentResult[]> {
    const results: ExperimentResult[] = [];

    for (const variant of variants) {
      // Simulate or fetch actual engagement data
      const result = await this.measureEngagement(variant.id);
      results.push(result);
    }

    // Determine winner
    const sortedResults = [...results].sort((a, b) =>
      b.engagementScore - a.engagementScore
    );

    if (sortedResults.length > 0) {
      sortedResults[0].isWinner = true;
    }

    return results;
  }

  /**
   * Measure engagement for a content variant
   */
  private static async measureEngagement(variantId: string): Promise<ExperimentResult> {
    // In production, this would fetch actual metrics
    // For now, return placeholder data
    return {
      variantId,
      engagementScore: Math.random() * 100,
      clickRate: Math.random() * 10,
      shareRate: Math.random() * 5,
      conversionRate: Math.random() * 3,
      sampleSize: Math.floor(Math.random() * 1000) + 100,
      confidence: Math.random() * 0.3 + 0.7, // 70-100%
      isWinner: false,
    };
  }

  /**
   * Get user preferences for content generation
   */
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const cache = getCache();
    return cache.get<UserPreferences>(`user:${userId}:preferences`);
  }

  /**
   * Score content quality
   */
  static scoreContentQuality(
    content: string,
    preferences?: UserPreferences
  ): number {
    let score = 0;

    // Engagement potential (questions, calls to action)
    const hasQuestion = content.includes('?');
    const hasCTA = /click|share|comment|follow|subscribe/i.test(content);
    score += (hasQuestion ? 20 : 0) + (hasCTA ? 15 : 0);
    score *= this.qualityWeights.engagement;

    // Readability (sentence length, vocabulary)
    const avgSentenceLength = content.split(/[.!?]+/).filter(s => s.trim()).length;
    const readabilityScore = avgSentenceLength < 20 ? 30 : avgSentenceLength < 30 ? 20 : 10;
    score += readabilityScore * this.qualityWeights.readability;

    // Relevance (keywords, topic focus)
    // This would need more context in production
    score += 25 * this.qualityWeights.relevance;

    // Originality (not using clichés)
    const cliches = ['at the end of the day', 'think outside the box', 'game changer'];
    const hasCliche = cliches.some(c => content.toLowerCase().includes(c));
    score += (hasCliche ? 10 : 25) * this.qualityWeights.originality;

    // Formatting (proper structure)
    const hasProperFormatting = content.includes('\n') || /[•\-\d+\.]/g.test(content);
    score += (hasProperFormatting ? 20 : 10) * this.qualityWeights.formatting;

    // Apply user preferences if available
    if (preferences) {
      const tone = this.detectTone(content);
      if (preferences.preferredTone.includes(tone)) {
        score *= 1.1; // 10% bonus
      }
      if (preferences.avoidedTone.includes(tone)) {
        score *= 0.9; // 10% penalty
      }
    }

    return Math.round(Math.min(100, score));
  }

  /**
   * Get current quality weights
   */
  static getQualityWeights(): QualityWeights {
    return { ...this.qualityWeights };
  }

  /**
   * Process feedback signal
   */
  static async processFeedback(
    userId: string,
    contentId: string,
    signal: FeedbackSignal
  ): Promise<void> {
    logger.info('Processing feedback signal', { userId, contentId, signal });

    // Store feedback for analysis
    const cache = getCache();
    const feedbackKey = `feedback:${userId}:${contentId}`;

    const existingFeedback = await cache.get<FeedbackSignal[]>(feedbackKey) || [];
    existingFeedback.push(signal);

    await cache.set(feedbackKey, existingFeedback, { ttl: 86400 * 7 }); // 7 days

    // Aggregate feedback if enough signals
    if (existingFeedback.length >= 5) {
      const positiveCount = existingFeedback.filter(f => f.signal === 'positive').length;
      const negativeCount = existingFeedback.filter(f => f.signal === 'negative').length;

      if (positiveCount > negativeCount * 2) {
        // Content is well-received
        logger.info('Content marked as high-quality', { contentId, positiveCount });
      } else if (negativeCount > positiveCount * 2) {
        // Content needs improvement
        logger.info('Content marked for improvement', { contentId, negativeCount });
      }
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Learn from a user edit
 */
export async function learnFromEdit(
  original: string,
  edited: string,
  userId: string
): Promise<void> {
  return QualityFeedbackLoop.learnFromEdit(original, edited, userId);
}

/**
 * Score content quality
 */
export function scoreQuality(
  content: string,
  userId?: string
): Promise<number> | number {
  if (userId) {
    return QualityFeedbackLoop.getUserPreferences(userId).then(prefs =>
      QualityFeedbackLoop.scoreContentQuality(content, prefs || undefined)
    );
  }
  return QualityFeedbackLoop.scoreContentQuality(content);
}

// Export default
export default QualityFeedbackLoop;
