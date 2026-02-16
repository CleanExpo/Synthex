/**
 * Advanced AI Content Generation System
 * Integrates with OpenRouter for multi-model content creation
 * Supports persona-based content generation for brand consistency
 */

import { getAIProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

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
  platform: 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'facebook' | 'youtube';
  topic?: string;
  tone?: 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';
  keywords?: string[];
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  includeCTA?: boolean;
  // Persona integration
  personaId?: string; // Use trained persona for voice/style
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
   * Generate AI content based on request parameters
   */
  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
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
          logger.info('Generating content with persona', { personaId: persona.id, personaName: persona.name });
        }
      } catch (error) {
        logger.warn('Failed to fetch persona, proceeding without', { personaId: request.personaId, error });
      }
    }

    // Build the prompt based on request and persona
    const prompt = this.buildPrompt(request, persona);

    // Select appropriate model based on content type
    const model = this.selectModel(request);

    try {
      // Generate main content
      const mainContent = await this.callAI(prompt, model);
      
      // Generate variations for A/B testing
      const variations = await this.generateVariations(mainContent, request);
      
      // Extract hashtags and emojis
      const hashtags = this.extractHashtags(mainContent);
      const emojis = this.extractEmojis(mainContent);
      
      // Generate hooks for better engagement
      const hooks = await this.generateHooks(request);
      
      // Calculate viral potential
      const viralScore = this.calculateViralScore(mainContent, request);
      
      // Estimate engagement
      const estimatedEngagement = this.estimateEngagement(mainContent, request);
      
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
        metadata: {
          generatedAt: new Date(),
          model,
          tokens: mainContent.split(' ').length * 1.3,
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      logger.error('Content generation pipeline failed', { error });
      throw new Error('Failed to generate content');
    }
  }

  /**
   * Build prompt for AI based on request and optional persona
   */
  private buildPrompt(request: ContentRequest, persona?: PersonaData | null): string {
    const platformGuides = {
      twitter: 'concise, engaging, max 280 characters, thread-friendly',
      instagram: 'visual storytelling, engaging captions, lifestyle-focused',
      linkedin: 'professional, insightful, value-driven, thought leadership',
      tiktok: 'trendy, youth-oriented, entertaining, short-form',
      facebook: 'community-focused, shareable, conversational',
      youtube: 'detailed, SEO-optimized, engaging hooks'
    };

    const toneGuides = {
      professional: 'formal, authoritative, data-driven',
      casual: 'friendly, conversational, relatable',
      humorous: 'witty, entertaining, light-hearted',
      inspirational: 'motivating, uplifting, empowering',
      educational: 'informative, clear, structured'
    };

    // Build persona instructions if available
    let personaInstructions = '';
    if (persona) {
      const vocabularyGuides: Record<string, string> = {
        simple: 'Use simple, everyday language. Short sentences. Easy to understand.',
        standard: 'Use standard vocabulary. Mix of simple and moderate complexity.',
        technical: 'Use industry-specific terminology. Technical but accessible.',
        sophisticated: 'Use sophisticated vocabulary. Eloquent and refined language.',
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

Generate content that will maximize engagement and shares.
    `.trim();
  }

  /**
   * Call OpenRouter API
   */
  private async callAI(prompt: string, model: string): Promise<string> {
    try {
      const response = await this.client.complete({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a viral content expert specializing in creating highly engaging social media content. Generate unique, creative content optimized for maximum engagement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      return content;
    } catch (error) {
      logger.error('AI content generation failed', { error });
      throw new Error('Content generation failed. AI service is temporarily unavailable. Please try again.');
    }
  }

  /**
   * Generate content variations for A/B testing
   */
  private async generateVariations(
    originalContent: string, 
    request: ContentRequest
  ): Promise<ContentVariation[]> {
    const variations: ContentVariation[] = [];
    
    // Style variations
    const styles = ['more casual', 'more formal', 'with urgency', 'question-based'];
    
    for (const style of styles.slice(0, 2)) { // Generate 2 variations
      const variationPrompt = `
Rewrite this content to be ${style}:
"${originalContent}"

Keep the same message but change the style and tone.
      `;
      
      try {
        const variation = await this.callAI(variationPrompt, this.models.fast);
        variations.push({
          id: `var-${Date.now()}-${Math.random()}`,
          content: variation,
          style,
          score: Math.random() * 100
        });
      } catch (error) {
        // Use simple transformation as fallback
        variations.push({
          id: `var-${Date.now()}-${Math.random()}`,
          content: this.transformStyle(originalContent, style),
          style,
          score: Math.random() * 100
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
        "Unpopular opinion:",
        "BREAKING:",
        "Thread 🧵:",
        "Hot take:"
      ],
      instagram: [
        "Stop scrolling!",
        "You won't believe...",
        "POV:",
        "This changed everything:",
        "Save this before it's gone!"
      ],
      linkedin: [
        "After 10 years, I learned...",
        "The truth about...",
        "Why successful people...",
        "3 lessons from...",
        "The future of..."
      ],
      tiktok: [
        "Wait for it...",
        "Part 1:",
        "You've been doing it wrong!",
        "Life hack alert!",
        "This is insane!"
      ],
      facebook: [
        "This is important:",
        "Please share:",
        "Everyone should know:",
        "I can't believe...",
        "Amazing story:"
      ],
      youtube: [
        "You Won't Believe...",
        "The Truth About...",
        "How to Actually...",
        "Why Everyone's Wrong About...",
        "The Secret to..."
      ]
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
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return content.match(emojiRegex) || [];
  }

  /**
   * Generate call-to-action
   */
  private generateCTA(request: ContentRequest): string {
    const ctas = {
      twitter: "💬 Reply with your thoughts!",
      instagram: "👆 Link in bio for more!",
      linkedin: "Connect with me for insights",
      tiktok: "Follow for Part 2!",
      facebook: "Share if you agree!",
      youtube: "Subscribe for more content!"
    };
    
    return ctas[request.platform] || "Learn more →";
  }

  /**
   * Calculate viral potential score
   */
  private calculateViralScore(content: string, request: ContentRequest): number {
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
      youtube: content.includes('Subscribe') ? 15 : 0
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
      youtube: 4.2
    };
    
    let rate = baseEngagement[request.platform] || 2.0;
    
    // Adjust based on content quality
    const viralScore = this.calculateViralScore(content, request);
    rate *= (viralScore / 50); // Multiply by viral factor
    
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
            platform: platform as any,
            tone: ['professional', 'casual', 'inspirational'][post % 3] as any,
            includeHashtags: true,
            includeEmojis: true,
            includeCTA: post === postsPerDay - 1 // CTA on last post
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
