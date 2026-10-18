/**
 * Content Moderation & Safety System
 *
 * @description Automated content safety checking, brand safety validation,
 * and compliance verification (GDPR, FTC, platform policies)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API for AI moderation (SECRET)
 *
 * FAILURE MODE: Flags content for human review if automated check fails
 *
 * NOT_PROVISIONED storage: `content_moderation_logs`, `content_reviews` and
 * `brand_guidelines` have no Prisma model (prisma/schema.prisma). Moderation
 * itself is pure computation and still runs; history and review submission
 * throw ModerationStorageNotProvisionedError; without explicit guidelines,
 * brand safety fails and the result requires human review; the moderation log
 * write is reported, not persisted.
 */

import { logger } from '@/lib/logger';
import { tableUnavailable } from '@/lib/api/not-provisioned';

/** Thrown when a moderation feature needs a table that is not provisioned. */
export class ModerationStorageNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  constructor(readonly table: string) {
    super(
      `Moderation storage is not provisioned: table "${table}" has no Prisma model`
    );
    this.name = 'ModerationStorageNotProvisionedError';
  }
}

// Safety check types
export type SafetyCategory =
  | 'hate_speech'
  | 'violence'
  | 'sexual'
  | 'harassment'
  | 'self_harm'
  | 'misinformation'
  | 'spam'
  | 'copyright'
  | 'brand_safety'
  | 'compliance';

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

// Moderation result
export interface ModerationResult {
  approved: boolean;
  riskLevel: RiskLevel;
  overallScore: number; // 0-100, higher = safer
  categories: CategoryResult[];
  brandSafety: BrandSafetyResult;
  compliance: ComplianceResult;
  suggestions: string[];
  requiresHumanReview: boolean;
  blockedReasons: string[];
  /** Set when stored brand guidelines were needed but could not be read. */
  brandGuidelines?: ReturnType<typeof tableUnavailable>;
}

export interface CategoryResult {
  category: SafetyCategory;
  score: number; // 0-100
  flagged: boolean;
  details?: string;
}

export interface BrandSafetyResult {
  passed: boolean;
  score: number;
  issues: Array<{
    type: string;
    severity: RiskLevel;
    description: string;
  }>;
  competitorMentions: string[];
  sensitiveTopics: string[];
}

export interface ComplianceResult {
  gdpr: { passed: boolean; issues: string[] };
  ftc: { passed: boolean; issues: string[] };
  platformPolicies: { passed: boolean; issues: string[] };
  coppa: { passed: boolean; issues: string[] };
}

// Brand guidelines
export interface BrandGuidelines {
  companyName: string;
  competitors: string[];
  blockedWords: string[];
  requiredDisclosures: string[];
  toneOfVoice: 'professional' | 'casual' | 'friendly' | 'authoritative';
  sensitiveTopics: string[];
  approvedHashtags: string[];
  blockedHashtags: string[];
}

// Harmful content patterns (basic patterns, would use AI in production)
const HARMFUL_PATTERNS = {
  hate_speech: [
    /\b(hate|kill|die)\s+\w+\b/gi,
    /\b(racist|sexist|homophobic)\b/gi,
  ],
  violence: [
    /\b(attack|murder|assault|weapon)\b/gi,
    /\b(gun|bomb|explosive)\b/gi,
  ],
  harassment: [/\b(harass|bully|threaten|stalk)\b/gi, /\b(doxx|doxing)\b/gi],
  spam: [
    /\b(click here|buy now|limited time|act fast)\b/gi,
    /(.)\1{5,}/g, // Repeated characters
  ],
  misinformation: [
    /\b(miracle cure|guaranteed results|100% effective)\b/gi,
    /\b(doctors hate|secret they don't want you to know)\b/gi,
  ],
};

// FTC disclosure requirements
const FTC_DISCLOSURE_PATTERNS = [
  /\b(sponsored|ad|advertisement|paid|partnership|gifted)\b/gi,
  /#ad\b/gi,
  /#sponsored\b/gi,
  /#partner\b/gi,
];

class ContentSafetyService {
  private cache: Map<string, { result: ModerationResult; expiry: number }> =
    new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  /**
   * Perform comprehensive content moderation check
   */
  async moderateContent(
    userId: string,
    content: string,
    options: {
      platform?: string;
      mediaUrls?: string[];
      brandGuidelines?: BrandGuidelines;
      checkType?: 'full' | 'quick';
      isPaidPromotion?: boolean;
      targetAudience?: 'general' | 'children' | 'adults';
    } = {}
  ): Promise<ModerationResult> {
    const cacheKey = this.generateCacheKey(content, options);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    try {
      // Get user's brand guidelines if not provided
      let brandGuidelines = options.brandGuidelines;
      if (!brandGuidelines) {
        brandGuidelines = await this.getUserBrandGuidelines(userId);
      }

      // Run all checks
      const [categories, brandSafety, compliance] = await Promise.all([
        this.checkSafetyCategories(content),
        this.checkBrandSafety(content, brandGuidelines),
        this.checkCompliance(content, options),
      ]);

      // Calculate overall score
      const categoryScores = categories.map(c => c.score);
      const avgCategoryScore =
        categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length;
      const brandScore = brandSafety.score;
      const complianceScore = this.calculateComplianceScore(compliance);

      const overallScore = Math.round(
        avgCategoryScore * 0.5 + brandScore * 0.3 + complianceScore * 0.2
      );

      // Determine risk level
      const riskLevel = this.determineRiskLevel(overallScore, categories);

      // Determine if approved
      const criticalIssues = categories.filter(c => c.flagged && c.score < 30);
      const approved =
        criticalIssues.length === 0 &&
        brandSafety.passed &&
        compliance.gdpr.passed &&
        compliance.ftc.passed;

      // Generate suggestions
      const suggestions = this.generateSuggestions(
        categories,
        brandSafety,
        compliance
      );

      // Determine blocked reasons
      const blockedReasons: string[] = [];
      categories
        .filter(c => c.flagged)
        .forEach(c => {
          blockedReasons.push(
            `${c.category}: ${c.details || 'Potentially harmful content detected'}`
          );
        });
      if (!brandSafety.passed) {
        brandSafety.issues.forEach(i => blockedReasons.push(i.description));
      }
      if (!compliance.ftc.passed) {
        compliance.ftc.issues.forEach(i => blockedReasons.push(i));
      }

      const result: ModerationResult = {
        approved,
        riskLevel,
        overallScore,
        categories,
        brandSafety,
        compliance,
        suggestions,
        requiresHumanReview:
          !brandGuidelines ||
          riskLevel === 'medium' ||
          criticalIssues.length > 0,
        blockedReasons,
        ...(!brandGuidelines && {
          brandGuidelines: tableUnavailable('brand_guidelines'),
        }),
      };

      // Cache result
      this.cache.set(cacheKey, { result, expiry: Date.now() + this.CACHE_TTL });

      // Log moderation result
      await this.logModeration(userId, content, result);

      return result;
    } catch (error: unknown) {
      logger.error('Content moderation failed:', { error, userId });

      // Return conservative result on error
      return {
        approved: false,
        riskLevel: 'medium',
        overallScore: 50,
        categories: [],
        brandSafety: {
          passed: false,
          score: 0,
          issues: [
            {
              type: 'error',
              severity: 'medium',
              description: 'Moderation check failed',
            },
          ],
          competitorMentions: [],
          sensitiveTopics: [],
        },
        compliance: {
          gdpr: { passed: true, issues: [] },
          ftc: { passed: true, issues: [] },
          platformPolicies: { passed: true, issues: [] },
          coppa: { passed: true, issues: [] },
        },
        suggestions: [
          'Manual review recommended due to moderation system error',
        ],
        requiresHumanReview: true,
        blockedReasons: [
          'Automated moderation check failed - manual review required',
        ],
      };
    }
  }

  /**
   * Quick safety check (faster, less comprehensive)
   */
  async quickCheck(content: string): Promise<{
    safe: boolean;
    score: number;
    flags: string[];
  }> {
    const flags: string[] = [];
    let score = 100;

    // Check each harmful pattern category
    for (const [category, patterns] of Object.entries(HARMFUL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          flags.push(category);
          score -= 20;
          break;
        }
      }
    }

    return {
      safe: score >= 60 && flags.length === 0,
      score: Math.max(0, score),
      flags: [...new Set(flags)],
    };
  }

  /**
   * Check if content needs FTC disclosure
   */
  checkFTCDisclosureRequired(
    content: string,
    options: {
      isPaidPromotion?: boolean;
      hasAffiliateLinks?: boolean;
      isGifted?: boolean;
    }
  ): { required: boolean; present: boolean; suggestion?: string } {
    const required =
      options.isPaidPromotion || options.hasAffiliateLinks || options.isGifted;
    const hasDisclosure = FTC_DISCLOSURE_PATTERNS.some(p => p.test(content));

    if (required && !hasDisclosure) {
      return {
        required: true,
        present: false,
        suggestion: 'Add #ad or #sponsored disclosure for FTC compliance',
      };
    }

    return { required: !!required, present: hasDisclosure };
  }

  /**
   * Get moderation history for user
   */
  async getModerationHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      onlyFlagged?: boolean;
    } = {}
  ): Promise<
    Array<{
      id: string;
      content: string;
      result: ModerationResult;
      createdAt: string;
    }>
  > {
    void userId;
    void options;
    throw new ModerationStorageNotProvisionedError('content_moderation_logs');
  }

  /**
   * Submit content for human review
   */
  async submitForReview(
    userId: string,
    contentId: string,
    content: string,
    moderationResult: ModerationResult,
    notes?: string
  ): Promise<{ reviewId: string; estimatedReviewTime: string }> {
    void userId;
    void contentId;
    void content;
    void moderationResult;
    void notes;
    throw new ModerationStorageNotProvisionedError('content_reviews');
  }

  // ==================== Private Methods ====================

  private async checkSafetyCategories(
    content: string
  ): Promise<CategoryResult[]> {
    const results: CategoryResult[] = [];
    const lowerContent = content.toLowerCase();

    for (const [category, patterns] of Object.entries(HARMFUL_PATTERNS)) {
      let flagged = false;
      let matchCount = 0;
      let details = '';

      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          flagged = true;
          matchCount += matches.length;
          details = `Found ${matchCount} potentially ${category.replace('_', ' ')} terms`;
        }
      }

      // Calculate score (100 = safe, 0 = dangerous)
      const score = flagged ? Math.max(0, 100 - matchCount * 25) : 100;

      results.push({
        category: category as SafetyCategory,
        score,
        flagged,
        details: flagged ? details : undefined,
      });
    }

    // Add generic safety categories with default safe scores
    const additionalCategories: SafetyCategory[] = [
      'sexual',
      'self_harm',
      'copyright',
    ];
    for (const category of additionalCategories) {
      if (!results.find(r => r.category === category)) {
        results.push({
          category,
          score: 95,
          flagged: false,
        });
      }
    }

    return results;
  }

  private async checkBrandSafety(
    content: string,
    guidelines?: BrandGuidelines
  ): Promise<BrandSafetyResult> {
    const issues: Array<{
      type: string;
      severity: RiskLevel;
      description: string;
    }> = [];
    const competitorMentions: string[] = [];
    const sensitiveTopics: string[] = [];
    let score = 100;

    // No guidelines were consulted, so brand safety is unknown, not passed.
    if (!guidelines) {
      return {
        passed: false,
        score: 0,
        issues: [
          {
            type: 'brand_guidelines_unavailable',
            severity: 'medium',
            description:
              'Brand guidelines unavailable: brand safety was not checked',
          },
        ],
        competitorMentions: [],
        sensitiveTopics: [],
      };
    }

    const lowerContent = content.toLowerCase();

    // Check for competitor mentions
    for (const competitor of guidelines.competitors || []) {
      if (lowerContent.includes(competitor.toLowerCase())) {
        competitorMentions.push(competitor);
        score -= 15;
        issues.push({
          type: 'competitor_mention',
          severity: 'medium',
          description: `Content mentions competitor: ${competitor}`,
        });
      }
    }

    // Check for blocked words
    for (const word of guidelines.blockedWords || []) {
      if (lowerContent.includes(word.toLowerCase())) {
        score -= 25;
        issues.push({
          type: 'blocked_word',
          severity: 'high',
          description: `Content contains blocked word: ${word}`,
        });
      }
    }

    // Check for sensitive topics
    for (const topic of guidelines.sensitiveTopics || []) {
      if (lowerContent.includes(topic.toLowerCase())) {
        sensitiveTopics.push(topic);
        score -= 10;
        issues.push({
          type: 'sensitive_topic',
          severity: 'low',
          description: `Content touches on sensitive topic: ${topic}`,
        });
      }
    }

    // Check hashtags
    const contentHashtags = content.match(/#\w+/g) || [];
    for (const hashtag of contentHashtags) {
      const lowerHashtag = hashtag.toLowerCase();
      if (
        (guidelines.blockedHashtags || []).some(
          h => h.toLowerCase() === lowerHashtag
        )
      ) {
        score -= 20;
        issues.push({
          type: 'blocked_hashtag',
          severity: 'medium',
          description: `Content uses blocked hashtag: ${hashtag}`,
        });
      }
    }

    return {
      passed:
        score >= 60 && issues.filter(i => i.severity === 'high').length === 0,
      score: Math.max(0, score),
      issues,
      competitorMentions,
      sensitiveTopics,
    };
  }

  private async checkCompliance(
    content: string,
    options: {
      isPaidPromotion?: boolean;
      targetAudience?: 'general' | 'children' | 'adults';
      platform?: string;
    }
  ): Promise<ComplianceResult> {
    const result: ComplianceResult = {
      gdpr: { passed: true, issues: [] },
      ftc: { passed: true, issues: [] },
      platformPolicies: { passed: true, issues: [] },
      coppa: { passed: true, issues: [] },
    };

    // FTC compliance (disclosure requirements)
    if (options.isPaidPromotion) {
      const hasDisclosure = FTC_DISCLOSURE_PATTERNS.some(p => p.test(content));
      if (!hasDisclosure) {
        result.ftc.passed = false;
        result.ftc.issues.push(
          'Paid promotion requires FTC disclosure (#ad, #sponsored, etc.)'
        );
      }
    }

    // COPPA compliance (children's content)
    if (options.targetAudience === 'children') {
      // Check for data collection language
      if (/\b(email|subscribe|sign up|register|join)\b/gi.test(content)) {
        result.coppa.passed = false;
        result.coppa.issues.push(
          'Content targeting children should not solicit personal information'
        );
      }
    }

    // GDPR compliance
    if (/\b(personal data|email list|subscriber data)\b/gi.test(content)) {
      result.gdpr.issues.push(
        'Content references personal data - ensure GDPR compliance'
      );
    }

    // Platform-specific policies
    if (options.platform === 'instagram') {
      // Instagram doesn't allow certain CTA language
      if (/\b(link in bio|comment to get)\b/gi.test(content)) {
        result.platformPolicies.issues.push(
          'Some engagement bait phrases may violate Instagram policies'
        );
      }
    }

    return result;
  }

  private async getUserBrandGuidelines(
    userId: string
  ): Promise<BrandGuidelines | undefined> {
    // `brand_guidelines` is not provisioned: there are no stored guidelines to
    // read; checkBrandSafety fails closed without them (explicit options still apply).
    logger.debug(
      'Stored brand guidelines unavailable: storage not provisioned',
      {
        reason: 'FEATURE_NOT_PROVISIONED',
        table: 'brand_guidelines',
        userId,
      }
    );
    return undefined;
  }

  private determineRiskLevel(
    score: number,
    categories: CategoryResult[]
  ): RiskLevel {
    const criticalFlags = categories.filter(
      c => c.flagged && c.score < 30
    ).length;
    const highFlags = categories.filter(c => c.flagged && c.score < 50).length;

    if (criticalFlags > 0 || score < 30) return 'critical';
    if (highFlags > 0 || score < 50) return 'high';
    if (score < 70) return 'medium';
    if (score < 90) return 'low';
    return 'safe';
  }

  private calculateComplianceScore(compliance: ComplianceResult): number {
    let score = 100;

    if (!compliance.gdpr.passed) score -= 25;
    if (!compliance.ftc.passed) score -= 25;
    if (!compliance.platformPolicies.passed) score -= 15;
    if (!compliance.coppa.passed) score -= 25;

    // Deduct for warnings too
    score -= compliance.gdpr.issues.length * 5;
    score -= compliance.ftc.issues.length * 5;
    score -= compliance.platformPolicies.issues.length * 3;
    score -= compliance.coppa.issues.length * 5;

    return Math.max(0, score);
  }

  private generateSuggestions(
    categories: CategoryResult[],
    brandSafety: BrandSafetyResult,
    compliance: ComplianceResult
  ): string[] {
    const suggestions: string[] = [];

    // Category-based suggestions
    categories
      .filter(c => c.flagged)
      .forEach(c => {
        switch (c.category) {
          case 'spam':
            suggestions.push(
              'Remove promotional language like "click here" or "buy now"'
            );
            break;
          case 'harassment':
            suggestions.push('Review content tone to ensure it is respectful');
            break;
          case 'misinformation':
            suggestions.push(
              'Remove unverified claims and add sources where appropriate'
            );
            break;
        }
      });

    // Brand safety suggestions
    if (brandSafety.competitorMentions.length > 0) {
      suggestions.push('Consider removing or rephrasing competitor mentions');
    }

    // Compliance suggestions
    if (!compliance.ftc.passed) {
      suggestions.push('Add required FTC disclosure (e.g., #ad, #sponsored)');
    }

    return suggestions;
  }

  private async logModeration(
    userId: string,
    content: string,
    result: ModerationResult
  ): Promise<void> {
    // `content_moderation_logs` is not provisioned: report the unpersisted
    // result instead of dropping it silently.
    logger.warn('Moderation result not persisted: storage not provisioned', {
      reason: 'FEATURE_NOT_PROVISIONED',
      table: 'content_moderation_logs',
      userId,
      contentLength: content.length,
      approved: result.approved,
      riskLevel: result.riskLevel,
      overallScore: result.overallScore,
    });
  }

  private generateCacheKey(
    content: string,
    options: Record<string, unknown>
  ): string {
    const contentHash = content.substring(0, 50) + content.length;
    return `mod-${contentHash}-${JSON.stringify(options)}`;
  }
}

// Export singleton
export const contentSafety = new ContentSafetyService();
