/**
 * Advanced AI Content Generation System
 * Integrates with OpenRouter for multi-model content creation
 * Supports persona-based content generation for brand consistency
 */

import { getAIProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { buildContextForGeneration } from '@/lib/obsidian/client-knowledge-base';
import { THINKING_EFFORTS } from '@/lib/ai/constants';
import {
  injectLayoutSignals,
  type AuthorBlockProps,
} from '@/lib/content/layout-renderer';

/** Optional user-supplied API credentials that override the platform key. */
export interface UserProviderCredentials {
  apiKey: string;
  provider: string;
}

// Business context used to personalise the AI system prompt
interface OrgContext {
  businessName: string;
  industry: string | null;
  location: string | null;
  brandVoice: string | null;
}

// Persona type from database
interface PersonaData {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  style: string;
  vocabulary: string;
  emotion: string;
  trainingSourcesCount: number;
  accuracy: number;
}

export interface ContentRequest {
  type: 'post' | 'caption' | 'thread' | 'story' | 'reel' | 'article';
  platform:
    | 'twitter'
    | 'instagram'
    | 'linkedin'
    | 'tiktok'
    | 'facebook'
    | 'youtube';
  topic?: string;
  tone?:
    | 'professional'
    | 'casual'
    | 'humorous'
    | 'inspirational'
    | 'educational'
    | 'friendly'
    | 'authoritative';
  keywords?: string[];
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  includeCTA?: boolean;
  // Persona integration
  personaId?: string; // Use trained persona for voice/style
  /** Organisation ID — enables Obsidian context injection when set. */
  orgId?: string;
  /** Enable extended thinking (Anthropic direct only). Defaults to false. */
  thinkingEnabled?: boolean;
  /** SEO content type — drives structure-aware article prompts (SYN-472). */
  seoContentType?:
    | 'blog_local_authority'
    | 'how_to'
    | 'listicle'
    | 'news_item'
    | 'comparison'
    | 'case_study';
  /** AEO/GEO mode — drives answer-engine and local-search optimisations (SYN-483). */
  contentMode?: 'standard' | 'aeo' | 'geo';
}

export interface GeneratedContent {
  id: string;
  content: string;
  platform: string;
  variations: ContentVariation[];
  hashtags: string[];
  emojis: string[];
  hooks: string[];
  cta?: string;
  estimatedEngagement: number;
  viralScore: number;
  /** Structured layout data injected for SEO article types (SYN-478). */
  layoutData?: Record<string, unknown>;
  metadata: {
    generatedAt: Date;
    model: string;
    tokens: number;
    processingTime: number;
  };
}

export interface ContentVariation {
  id: string;
  content: string;
  style: string;
  score: number;
}

export class AIContentGenerator {
  private get client(): AIProvider {
    return getAIProvider();
  }

  private get models() {
    return this.client.models;
  }

  constructor() {
    // Provider availability is checked lazily when first used
  }

  /**
   * Generate AI content based on request parameters.
   *
   * @param request - Content generation parameters
   * @param userCredentials - Optional user-supplied API key; when provided it
   *   overrides the platform-level key for this request only.
   */
  async generateContent(
    request: ContentRequest,
    userCredentials?: UserProviderCredentials
  ): Promise<GeneratedContent> {
    const startTime = Date.now();

    // Fetch persona data if personaId provided
    let persona: PersonaData | null = null;
    if (request.personaId) {
      try {
        persona = await prisma.persona.findUnique({
          where: { id: request.personaId },
          select: {
            id: true,
            name: true,
            description: true,
            tone: true,
            style: true,
            vocabulary: true,
            emotion: true,
            trainingSourcesCount: true,
            accuracy: true,
          },
        });
        if (persona) {
          logger.info('Generating content with persona', {
            personaId: persona.id,
            personaName: persona.name,
          });
        }
      } catch (error) {
        logger.warn('Failed to fetch persona, proceeding without', {
          personaId: request.personaId,
          error,
        });
      }
    }

    // Auto-classify seoContentType for articles when not explicitly provided (SYN-479)
    if (
      request.type === 'article' &&
      !request.seoContentType &&
      request.topic
    ) {
      request.seoContentType = inferSeoContentType(request.topic);
    }

    // Auto-select contentMode for articles when not explicitly provided (SYN-483)
    if (request.type === 'article' && !request.contentMode) {
      request.contentMode = 'aeo'; // default: optimise for AI Overviews
    }

    // Auto-pick topic from GSC suggestions when no topic supplied (SYN-472)
    if (!request.topic && request.orgId) {
      try {
        const suggestion = await prisma.contentTopicSuggestion.findFirst({
          where: { organizationId: request.orgId, usedAt: null },
          orderBy: { opportunityScore: 'desc' },
        });
        if (suggestion) {
          request.topic = suggestion.keyword;
          await prisma.contentTopicSuggestion.update({
            where: { id: suggestion.id },
            data: { usedAt: new Date() },
          });
        }
      } catch {
        // Non-fatal — proceed without suggestion
      }
    }

    // Build org context for business-aware system prompt (SYN-472)
    const orgContext = request.orgId
      ? await this.buildOrgContext(request.orgId)
      : null;

    // Build Obsidian context for this client (no-op when disabled or orgId absent)
    const obsidianContext = request.orgId
      ? await buildContextForGeneration(request.orgId)
      : '';

    // Build the prompt based on request and persona, enriched with research insights
    const researchContext = await this.fetchResearchContext(
      request.platform,
      request.orgId ?? undefined
    );
    const prompt =
      (obsidianContext ? `${obsidianContext}\n\n---\n\n` : '') +
      this.buildPrompt(request, persona) +
      researchContext;

    // Select appropriate model based on content type
    const model = this.selectModel(request);

    // Determine thinking effort (Anthropic direct only; ignored on other providers)
    const thinkingEffort = request.thinkingEnabled
      ? model.includes('opus')
        ? THINKING_EFFORTS.max
        : THINKING_EFFORTS.medium
      : undefined;

    // Resolve which AI provider to use for this request.
    // User credentials take priority over the platform singleton.
    const aiClient: AIProvider = userCredentials
      ? getAIProvider({
          apiKey: userCredentials.apiKey,
          provider: userCredentials.provider as
            | 'openrouter'
            | 'anthropic'
            | 'google',
        })
      : this.client;

    try {
      // Generate main content
      let mainContent = await this.callAI(
        prompt,
        model,
        aiClient,
        thinkingEffort,
        orgContext
      );

      // Inject E-E-A-T layout signals for SEO articles (SYN-478)
      let layoutData: Record<string, unknown> | undefined;
      if (
        request.type === 'article' &&
        request.seoContentType &&
        request.orgId
      ) {
        const authorData = await this.buildAuthorData(request.orgId);
        if (authorData) {
          mainContent = injectLayoutSignals(
            mainContent,
            authorData.orgData,
            authorData.author,
            request.seoContentType,
            request.contentMode
          );
          layoutData = {
            seoContentType: request.seoContentType,
            contentMode: request.contentMode ?? 'standard',
            authorName: authorData.author.name,
            suburb: authorData.orgData.suburb,
          };
        }
      }

      // Generate variations for A/B testing
      const variations = await this.generateVariations(
        mainContent,
        request,
        aiClient
      );

      // Extract hashtags and emojis
      const hashtags = this.extractHashtags(mainContent);
      const emojis = this.extractEmojis(mainContent);

      // Generate hooks for better engagement
      const hooks = await this.generateHooks(request);

      // Calculate viral potential
      const viralScore = this.calculateViralScore(mainContent, request);

      // Estimate engagement
      const estimatedEngagement = this.estimateEngagement(mainContent, request);

      const processingTime = Date.now() - startTime;
      const estimatedTokens = Math.round(mainContent.split(' ').length * 1.3);

      // Instrument model metrics (SYN-486) — fire-and-forget
      recordModelMetric({
        modelId: model,
        contentType: request.type,
        tokens: estimatedTokens,
        latencyMs: processingTime,
      }).catch(() => {});

      return {
        id: `content-${Date.now()}`,
        content: mainContent,
        platform: request.platform,
        variations,
        hashtags,
        emojis,
        hooks,
        cta: request.includeCTA ? this.generateCTA(request) : undefined,
        estimatedEngagement,
        viralScore,
        ...(layoutData ? { layoutData } : {}),
        metadata: {
          generatedAt: new Date(),
          model,
          tokens: estimatedTokens,
          processingTime,
        },
      };
    } catch (error) {
      logger.error('Content generation pipeline failed', { error });
      throw new Error('Failed to generate content');
    }
  }

  /**
   * Fetch recent high-confidence trend insights for a platform.
   * Returns a formatted string to append to the generation prompt,
   * or an empty string if no insights are available.
   */
  private async fetchResearchContext(
    platform: string,
    orgId?: string | null
  ): Promise<string> {
    try {
      const now = new Date();
      const insights = await prisma.trendInsight.findMany({
        where: {
          platform,
          confidence: { gte: 0.7 },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
          AND: [
            {
              OR: [
                { organizationId: null },
                ...(orgId ? [{ organizationId: orgId }] : []),
              ],
            },
          ],
        },
        orderBy: { confidence: 'desc' },
        take: 5,
      });

      if (insights.length === 0) return '';

      const bullets = insights
        .map(i => `• [${i.category}] ${i.insight}`)
        .join('\n');

      return `\n\nCurrent trending patterns for ${platform}:\n${bullets}`;
    } catch {
      // Non-fatal — proceed without research context
      return '';
    }
  }

  /**
   * Build prompt for AI based on request and optional persona
   */
  private buildPrompt(
    request: ContentRequest,
    persona?: PersonaData | null
  ): string {
    const platformGuides = {
      twitter: 'concise, engaging, max 280 characters, thread-friendly',
      instagram: 'visual storytelling, engaging captions, lifestyle-focused',
      linkedin: 'professional, insightful, value-driven, thought leadership',
      tiktok: 'trendy, youth-oriented, entertaining, short-form',
      facebook: 'community-focused, shareable, conversational',
      youtube: 'detailed, SEO-optimized, engaging hooks',
    };

    const toneGuides = {
      professional: 'formal, authoritative, data-driven',
      casual: 'friendly, conversational, relatable',
      humorous: 'witty, entertaining, light-hearted',
      inspirational: 'motivating, uplifting, empowering',
      educational: 'informative, clear, structured',
    };

    // Build persona instructions if available
    let personaInstructions = '';
    if (persona) {
      const vocabularyGuides: Record<string, string> = {
        simple:
          'Use simple, everyday language. Short sentences. Easy to understand.',
        standard:
          'Use standard vocabulary. Mix of simple and moderate complexity.',
        technical:
          'Use industry-specific terminology. Technical but accessible.',
        sophisticated:
          'Use sophisticated vocabulary. Eloquent and refined language.',
      };

      const emotionGuides: Record<string, string> = {
        neutral: 'Maintain a balanced, objective emotional tone.',
        friendly: 'Be warm, approachable, and personable.',
        confident: 'Project authority and self-assurance.',
        inspiring: 'Be uplifting and motivational.',
      };

      personaInstructions = `
## PERSONA VOICE PROFILE: "${persona.name}"
${persona.description ? `Brand Description: ${persona.description}` : ''}

Voice Characteristics (MUST FOLLOW):
- Primary Tone: ${persona.tone}
- Writing Style: ${persona.style}
- Vocabulary Level: ${vocabularyGuides[persona.vocabulary] || persona.vocabulary}
- Emotional Register: ${emotionGuides[persona.emotion] || persona.emotion}

IMPORTANT: Match this persona's unique voice exactly. The content should sound like it came from this specific brand/person, not generic AI.
`;
    }

    // Determine effective tone (persona overrides request if available)
    const effectiveTone = persona?.tone || request.tone;

    // Build SEO content type structure directive (SYN-475)
    const seoStructure = buildSeoContentTypeDirective(request.seoContentType);
    // Build AEO/GEO content mode directive (SYN-483)
    const modeDirective = buildContentModeDirective(request.contentMode);

    return `
${personaInstructions}
Generate a ${request.type} for ${request.platform}.

Platform Style: ${platformGuides[request.platform]}
Tone: ${effectiveTone ? toneGuides[effectiveTone as keyof typeof toneGuides] || effectiveTone : 'balanced'}
Topic: ${request.topic || 'trending content'}
Target Audience: ${request.targetAudience || 'general audience'}
Length: ${request.length || 'medium'}

Requirements:
- ${request.includeEmojis ? 'Include relevant emojis' : 'Minimal or no emojis'}
- ${request.includeHashtags ? 'Include 5-10 relevant hashtags' : 'No hashtags'}
- ${request.includeCTA ? 'Include a clear call-to-action' : 'No explicit CTA'}
- Optimize for viral potential
- Make it highly engaging
${request.keywords?.length ? `- Include keywords: ${request.keywords.join(', ')}` : ''}
${persona ? '- CRITICAL: Match the persona voice profile exactly' : ''}
${seoStructure}
${modeDirective}

Generate content that will maximize engagement and shares.
    `.trim();
  }

  /**
   * Fetch business context for system prompt personalisation (SYN-472).
   */
  private async buildOrgContext(orgId: string): Promise<OrgContext | null> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, industry: true, aiGeneratedData: true },
      });
      if (!org) return null;

      const aiData = org.aiGeneratedData as Record<string, unknown> | null;
      const location =
        (aiData?.suburb as string) ??
        (aiData?.city as string) ??
        (aiData?.location as string) ??
        null;
      const brandVoice =
        (aiData?.brandVoice as string) ?? (aiData?.tone as string) ?? null;

      return {
        businessName: org.name,
        industry: org.industry,
        location,
        brandVoice,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch author and org data for E-E-A-T layout injection (SYN-478).
   * Returns null when the org has insufficient data (no GBP, no users).
   */
  private async buildAuthorData(orgId: string): Promise<{
    orgData: { name: string; suburb: string; phone?: string };
    author: AuthorBlockProps;
  } | null> {
    try {
      const [org, gbpLocation, owner] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true, aiGeneratedData: true },
        }),
        prisma.gBPLocation.findFirst({
          where: { organizationId: orgId, isPrimary: true },
          select: { phone: true, newReviewUri: true },
        }),
        prisma.user.findFirst({
          where: { organizationId: orgId },
          select: { name: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      if (!org) return null;

      const aiData = org.aiGeneratedData as Record<string, unknown> | null;
      const suburb =
        (aiData?.suburb as string) ??
        (aiData?.city as string) ??
        (aiData?.location as string) ??
        '';

      const phone =
        gbpLocation?.phone ??
        (aiData?.phone as string | undefined) ??
        undefined;

      return {
        orgData: { name: org.name, suburb, phone },
        author: {
          name: owner?.name ?? org.name,
          credential: (aiData?.industry as string) ?? 'Business Owner',
          experienceYears: 0,
          gbpLink: gbpLocation?.newReviewUri ?? undefined,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Call the AI provider with the given prompt.
   *
   * @param prompt - Fully-built prompt string
   * @param model - Model identifier to use
   * @param client - Resolved AIProvider instance (platform or user key)
   * @param thinking - Adaptive thinking effort level (undefined = disabled; Anthropic only)
   * @param orgContext - Optional org context for business-aware system prompt
   */
  private async callAI(
    prompt: string,
    model: string,
    client: AIProvider,
    thinking?: 'low' | 'medium' | 'high' | 'max',
    orgContext?: OrgContext | null
  ): Promise<string> {
    const rawSystemPrompt = orgContext
      ? `You are a content expert for ${orgContext.businessName}${orgContext.industry ? `, a ${orgContext.industry} business` : ''}${orgContext.location ? ` in ${orgContext.location}` : ''}. ${orgContext.brandVoice ?? 'Generate unique, creative content optimized for maximum engagement.'}`
      : 'You are a viral content expert specializing in creating highly engaging social media content. Generate unique, creative content optimized for maximum engagement.';
    const systemPrompt = withAntiSlop(rawSystemPrompt);

    try {
      const response = await client.complete({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: prompt.includes('article') ? 3000 : 1000,
        ...(thinking
          ? { thinking, thinkingDisplay: 'omitted' as const, cache: true }
          : {}),
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      return content;
    } catch (error) {
      logger.error('AI content generation failed', { error });
      throw new Error(
        'Content generation failed. AI service is temporarily unavailable. Please try again.'
      );
    }
  }

  /**
   * Generate content variations for A/B testing
   */
  private async generateVariations(
    originalContent: string,
    request: ContentRequest,
    aiClient: AIProvider
  ): Promise<ContentVariation[]> {
    const variations: ContentVariation[] = [];

    // Style variations
    const styles = [
      'more casual',
      'more formal',
      'with urgency',
      'question-based',
    ];

    for (const style of styles.slice(0, 2)) {
      // Generate 2 variations
      const variationPrompt = `
Rewrite this content to be ${style}:
"${originalContent}"

Keep the same message but change the style and tone.
      `;

      try {
        const variation = await this.callAI(
          variationPrompt,
          this.models.fast,
          aiClient
        );
        variations.push({
          id: `var-${crypto.randomUUID()}`,
          content: variation,
          style,
          score: 0, // Score should be calculated from actual engagement data, not randomized
        });
      } catch (error) {
        // Use simple transformation as fallback
        variations.push({
          id: `var-${crypto.randomUUID()}`,
          content: this.transformStyle(originalContent, style),
          style,
          score: 0,
        });
      }
    }

    return variations;
  }

  /**
   * Transform content style (fallback)
   */
  private transformStyle(content: string, style: string): string {
    switch (style) {
      case 'more casual':
        return content
          .replace(/\./g, '!')
          .replace(/We are/g, "We're")
          .replace(/It is/g, "It's");
      case 'more formal':
        return content
          .replace(/!/g, '.')
          .replace(/We're/g, 'We are')
          .replace(/It's/g, 'It is');
      case 'with urgency':
        return `⚡ LIMITED TIME: ${content} Act NOW! ⏰`;
      case 'question-based':
        return `Did you know? ${content} What do you think?`;
      default:
        return content;
    }
  }

  /**
   * Generate engaging hooks
   */
  private async generateHooks(request: ContentRequest): Promise<string[]> {
    const hooks = {
      twitter: [
        "Here's what nobody tells you about...",
        'Unpopular opinion:',
        'BREAKING:',
        'Thread 🧵:',
        'Hot take:',
      ],
      instagram: [
        'Stop scrolling!',
        "You won't believe...",
        'POV:',
        'This changed everything:',
        "Save this before it's gone!",
      ],
      linkedin: [
        'After 10 years, I learned...',
        'The truth about...',
        'Why successful people...',
        '3 lessons from...',
        'The future of...',
      ],
      tiktok: [
        'Wait for it...',
        'Part 1:',
        "You've been doing it wrong!",
        'Life hack alert!',
        'This is insane!',
      ],
      facebook: [
        'This is important:',
        'Please share:',
        'Everyone should know:',
        "I can't believe...",
        'Amazing story:',
      ],
      youtube: [
        "You Won't Believe...",
        'The Truth About...',
        'How to Actually...',
        "Why Everyone's Wrong About...",
        'The Secret to...',
      ],
    };

    return hooks[request.platform] || hooks.twitter;
  }

  /**
   * Extract hashtags from content
   */
  private extractHashtags(content: string): string[] {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }

  /**
   * Extract emojis from content
   */
  private extractEmojis(content: string): string[] {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return content.match(emojiRegex) || [];
  }

  /**
   * Generate call-to-action
   */
  private generateCTA(request: ContentRequest): string {
    const ctas = {
      twitter: '💬 Reply with your thoughts!',
      instagram: '👆 Link in bio for more!',
      linkedin: 'Connect with me for insights',
      tiktok: 'Follow for Part 2!',
      facebook: 'Share if you agree!',
      youtube: 'Subscribe for more content!',
    };

    return ctas[request.platform] || 'Learn more →';
  }

  /**
   * Calculate viral potential score
   */
  private calculateViralScore(
    content: string,
    request: ContentRequest
  ): number {
    let score = 50; // Base score

    // Check for viral elements
    if (content.includes('?')) score += 10; // Questions engage
    if (content.includes('!')) score += 5; // Excitement
    if (content.match(/\d+/)) score += 10; // Numbers/lists
    if (content.length < 280) score += 10; // Concise
    if (this.extractEmojis(content).length > 0) score += 5; // Visual appeal
    if (this.extractHashtags(content).length > 3) score += 10; // Discoverability

    // Platform-specific bonuses
    const platformBonus = {
      twitter: content.includes('Thread') ? 15 : 0,
      instagram: content.includes('Save') ? 15 : 0,
      linkedin: content.includes('insight') ? 15 : 0,
      tiktok: content.includes('Part') ? 15 : 0,
      facebook: content.includes('Share') ? 15 : 0,
      youtube: content.includes('Subscribe') ? 15 : 0,
    };

    score += platformBonus[request.platform] || 0;

    return Math.min(100, score);
  }

  /**
   * Estimate engagement rate
   */
  private estimateEngagement(content: string, request: ContentRequest): number {
    const baseEngagement = {
      twitter: 2.5,
      instagram: 3.8,
      linkedin: 2.0,
      tiktok: 5.5,
      facebook: 1.8,
      youtube: 4.2,
    };

    let rate = baseEngagement[request.platform] || 2.0;

    // Adjust based on content quality
    const viralScore = this.calculateViralScore(content, request);
    rate *= viralScore / 50; // Multiply by viral factor

    return Math.round(rate * 100) / 100;
  }

  /**
   * Select appropriate AI model
   */
  private selectModel(request: ContentRequest): string {
    if (request.type === 'article' || request.length === 'long') {
      return this.models.creative;
    }
    if (request.platform === 'twitter' || request.length === 'short') {
      return this.models.fast;
    }
    return this.models.balanced;
  }

  /**
   * Batch generate content
   */
  async batchGenerate(requests: ContentRequest[]): Promise<GeneratedContent[]> {
    const results = await Promise.all(
      requests.map(request => this.generateContent(request))
    );
    return results;
  }

  /**
   * Generate content calendar
   */
  async generateContentCalendar(
    days: number,
    platforms: string[],
    postsPerDay: number
  ): Promise<Map<string, GeneratedContent[]>> {
    const calendar = new Map<string, GeneratedContent[]>();

    for (let day = 0; day < days; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      const dateKey = date.toISOString().split('T')[0];

      const dayContent: GeneratedContent[] = [];

      for (const platform of platforms) {
        for (let post = 0; post < postsPerDay; post++) {
          const content = await this.generateContent({
            type: 'post',
            platform: platform as ContentRequest['platform'],
            tone: (
              [
                'professional',
                'casual',
                'inspirational',
              ] as ContentRequest['tone'][]
            )[post % 3],
            includeHashtags: true,
            includeEmojis: true,
            includeCTA: post === postsPerDay - 1, // CTA on last post
          });

          dayContent.push(content);
        }
      }

      calendar.set(dateKey, dayContent);
    }

    return calendar;
  }
}

// Export singleton instance
export const aiContentGenerator = new AIContentGenerator();

// ============================================================================
// SEO CONTENT TYPE CLASSIFICATION (SYN-479)
// ============================================================================

/**
 * Infer the best-fit SeoContentType from a plain-language topic string.
 * Used when seoContentType is not explicitly provided by the caller.
 * Falls back to 'blog_local_authority' for local-business content.
 */
export function inferSeoContentType(
  topic: string
): ContentRequest['seoContentType'] {
  const t = topic.toLowerCase();
  if (/\bhow[\s-]to\b/.test(t)) return 'how_to';
  if (/\b(news|update|announcement|launch|release)\b/.test(t))
    return 'news_item';
  if (/\b(vs\.?|versus|compare|comparison)\b/.test(t)) return 'comparison';
  if (/\b(case[\s-]study|success story|results)\b/.test(t)) return 'case_study';
  if (
    /\b(\d+|best|top|worst|most)\b.{0,20}\b(tips?|ways?|things?|reasons?|ideas?)\b/.test(
      t
    )
  )
    return 'listicle';
  return 'blog_local_authority';
}

// ============================================================================
// SEO CONTENT TYPE PROMPTS (SYN-475)
// ============================================================================

/**
 * Returns a content structure directive for the given SEO content type.
 * Appended to the main buildPrompt output when seoContentType is set.
 */
function buildSeoContentTypeDirective(
  seoContentType: ContentRequest['seoContentType']
): string {
  if (!seoContentType) return '';

  switch (seoContentType) {
    case 'blog_local_authority':
      return `
CONTENT STRUCTURE — LOCAL AUTHORITY ARTICLE:
- H1: "[Service] in [Suburb] — [Year] Guide"
- Open with an author credential statement (who you are, how long in the trade)
- Include at least 2 H2s referencing the suburb or location
- Include a quote from the business owner's perspective
- CTA: "Call [Business Name] in [Suburb] on [phone]"`;

    case 'how_to':
      return `
CONTENT STRUCTURE — HOW-TO GUIDE:
- H1: "How to [Action] in [Suburb/State]"
- Numbered steps (minimum 5), each as H2
- Include an "Expert Tip" callout after step 2
- End with FAQ section (5 questions, formatted as Q: / A:)`;

    case 'listicle':
      return `
CONTENT STRUCTURE — LISTICLE:
- H1: "[Number] Best [Thing] in [Suburb/Area] ([Year])"
- Each item as a numbered H2
- Include the business as one of the items (not first)
- End with a comparison summary table (3 columns: Provider | Specialty | Contact)`;

    case 'news_item':
      return `
CONTENT STRUCTURE — NEWS ITEM:
- H1: Newsy headline with location and date
- Lead paragraph: who, what, when, where, why (inverted pyramid)
- Include 1 quote from a named source
- End with "About [Business Name]" boilerplate paragraph`;

    case 'comparison':
      return `
CONTENT STRUCTURE — COMPARISON:
- H1: "[Option A] vs [Option B]: Which is Right for You?"
- Summary table at the top (at least 5 comparison rows)
- H2 for each option with pros and cons
- Conclusion recommending based on use case`;

    case 'case_study':
      return `
CONTENT STRUCTURE — CASE STUDY:
- H1: "How [Business] Helped [Client Type] [Achieve Result]"
- Sections: The Challenge | Our Approach | The Results | Client Testimonial
- Include specific metrics (numbers, percentages, timeframes)
- End with CTA to book a consultation`;

    default:
      return '';
  }
}

// ============================================================================
// AEO / GEO CONTENT MODE DIRECTIVES (SYN-483)
// ============================================================================

/**
 * Returns an additional prompt directive for the given content mode.
 * AEO = Answer Engine Optimisation (Google AI Overviews, Perplexity, ChatGPT).
 * GEO = Generative Engine Optimisation for local search.
 */
function buildContentModeDirective(
  contentMode: ContentRequest['contentMode']
): string {
  if (!contentMode || contentMode === 'standard') return '';

  if (contentMode === 'aeo') {
    return `
AEO MODE — ANSWER ENGINE OPTIMISATION:
- Open with a direct 40-word answer paragraph (the AI snippet bait) — no preamble
- Include a "Quick Answer" H2 section in the first third of the article
- End with an FAQ section: 5 questions formatted as Q: / A: pairs
- Cite 2–3 statistics inline with source attribution (e.g. "According to the ABS, ...")
- End with a 3-column summary table: Topic | Key Point | Source
- Write in a factual, authoritative tone — optimise for zero-click answers`;
  }

  if (contentMode === 'geo') {
    return `
GEO MODE — LOCAL SEARCH OPTIMISATION:
- H1 must contain suburb + service + current year (e.g. "Plumber in Parramatta — 2026 Guide")
- Include at least 3 locality signals in the body: street names, local landmarks, council area, or postcodes
- NAP block as the last element before the CTA: Name | Address | Phone in plain text
- Reference local competition (e.g. "Unlike other [service] providers in [suburb], ...")
- Use a conversational tone — write as if speaking to a local resident`;
  }

  return '';
}

// ============================================================================
// MODEL METRICS INSTRUMENTATION (SYN-486)
// ============================================================================

/**
 * Derive the provider from a model ID string.
 */
function inferProvider(modelId: string): string {
  if (modelId.startsWith('claude')) return 'anthropic';
  if (
    modelId.startsWith('gpt') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3')
  )
    return 'openai';
  if (modelId.startsWith('gemini')) return 'google';
  return 'openrouter';
}

/**
 * Upsert weekly model usage metrics. Called fire-and-forget after each generation.
 */
async function recordModelMetric(params: {
  modelId: string;
  contentType: string;
  tokens: number;
  latencyMs: number;
}): Promise<void> {
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  // Round back to Monday
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - (day === 0 ? 6 : day - 1));

  const provider = inferProvider(params.modelId);

  // Fetch cost from registry if available
  let costUsd = 0;
  try {
    const { getModel } = await import('@/lib/ai/model-registry');
    const config = getModel(
      provider as import('@/lib/ai/model-registry').AIProvider,
      params.modelId
    );
    if (config) {
      const inputTokens = Math.round(params.tokens * 0.4);
      const outputTokens = Math.round(params.tokens * 0.6);
      costUsd =
        (inputTokens / 1000) * config.costPer1kTokens.input +
        (outputTokens / 1000) * config.costPer1kTokens.output;
    }
  } catch {
    // Non-fatal — proceed without cost data
  }

  await prisma.modelMetric.upsert({
    where: {
      modelId_contentType_weekStart: {
        modelId: params.modelId,
        contentType: params.contentType,
        weekStart,
      },
    },
    update: {
      requestCount: { increment: 1 },
      totalTokens: { increment: params.tokens },
      totalCostUsd: { increment: costUsd },
      avgLatencyMs: params.latencyMs,
    },
    create: {
      modelId: params.modelId,
      provider,
      contentType: params.contentType,
      requestCount: 1,
      totalTokens: params.tokens,
      totalCostUsd: costUsd,
      avgLatencyMs: params.latencyMs,
      weekStart,
    },
  });
}
