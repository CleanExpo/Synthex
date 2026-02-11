/**
 * Content Generation Service
 * Generates AI-powered content based on personas and viral patterns
 */

import { db } from '@/lib/supabase-client';

// Platform-specific content requirements
/** Platform content requirements */
interface PlatformRequirements {
  maxLength: number;
  supportedFormats: string[];
  hashtagLimit: number;
  mentionLimit: number;
  threadSupport?: boolean;
  articleSupport?: boolean;
  soundRequired?: boolean;
  reelsSupport?: boolean;
  storySupport?: boolean;
}

/** Persona for content voice */
interface ContentPersona {
  name?: string;
  attributes?: {
    tone?: 'Professional' | 'Casual' | 'Authoritative' | string;
    style?: 'Formal' | 'Conversational' | 'Thought-provoking' | string;
    emotion?: string;
  };
}

/** Content enhancement options */
interface ContentEnhanceOptions {
  includeEmojis: boolean;
  includeHashtags: boolean;
  platform: string;
}

/** Placeholder replacement data */
interface PlaceholderData {
  topic: string;
  [key: string]: string;
}

const PLATFORM_REQUIREMENTS: Record<string, PlatformRequirements> = {
  twitter: {
    maxLength: 280,
    supportedFormats: ['text', 'image', 'video', 'gif'],
    hashtagLimit: 3,
    mentionLimit: 5,
    threadSupport: true,
  },
  linkedin: {
    maxLength: 3000,
    supportedFormats: ['text', 'image', 'video', 'document'],
    hashtagLimit: 5,
    mentionLimit: 10,
    articleSupport: true,
  },
  tiktok: {
    maxLength: 2200,
    supportedFormats: ['video'],
    hashtagLimit: 10,
    mentionLimit: 5,
    soundRequired: true,
  },
  instagram: {
    maxLength: 2200,
    supportedFormats: ['image', 'video', 'carousel'],
    hashtagLimit: 30,
    mentionLimit: 10,
    reelsSupport: true,
  },
  facebook: {
    maxLength: 63206,
    supportedFormats: ['text', 'image', 'video', 'link'],
    hashtagLimit: 10,
    mentionLimit: 10,
    storySupport: true,
  },
};

// Content generation templates
const CONTENT_TEMPLATES = {
  question: {
    starters: [
      "What's your take on {topic}?",
      "How do you approach {topic}?",
      "Why do you think {topic} matters?",
      "When did you realize {topic}?",
      "Who else struggles with {topic}?",
    ],
    middles: [
      "I've been thinking about this because {reason}",
      "This matters more than ever since {context}",
      "I used to think {old_belief}, but now {new_belief}",
    ],
    endings: [
      "Share your thoughts below 👇",
      "What's been your experience?",
      "Let me know in the comments!",
      "RT if you agree!",
      "Drop a ❤️ if this resonates",
    ],
  },
  story: {
    starters: [
      "Just had the most {adjective} experience with {topic}",
      "Story time: {topic} changed everything",
      "Yesterday I learned something about {topic}",
      "Can't believe what happened with {topic}",
      "Remember when {topic} was impossible?",
    ],
    middles: [
      "At first, {initial_state}. Then {transformation}. Now {result}",
      "The journey taught me {lesson}",
      "Three things happened: {point1}, {point2}, and {point3}",
    ],
    endings: [
      "The lesson? {key_takeaway}",
      "Moral of the story: {lesson}",
      "What would you have done?",
      "Has this happened to you?",
    ],
  },
  educational: {
    starters: [
      "Here's how to {action} in {number} steps:",
      "{number} tips for {goal}:",
      "The complete guide to {topic}:",
      "Everything you need to know about {topic}:",
      "Master {topic} with these {number} techniques:",
    ],
    middles: [
      "Step {number}: {action} - {explanation}",
      "Tip #{number}: {advice} (This works because {reason})",
      "Key insight: {insight} leads to {result}",
    ],
    endings: [
      "Save this for later! 📌",
      "Which tip will you try first?",
      "Follow for more {topic} content",
      "Share if this helped you!",
    ],
  },
  achievement: {
    starters: [
      "🎉 Excited to announce {achievement}!",
      "We just hit {milestone}!",
      "Proud to share that {accomplishment}",
      "Finally achieved {goal} after {timeframe}",
      "Big news: {announcement}",
    ],
    middles: [
      "This wouldn't be possible without {acknowledgment}",
      "The journey involved {challenges} but {outcome}",
      "Key factors: {factor1}, {factor2}, and {factor3}",
    ],
    endings: [
      "Thank you for being part of this journey!",
      "Onwards and upwards! 🚀",
      "What's your biggest win this week?",
      "Celebrating with the team today!",
    ],
  },
};

export class ContentGeneratorService {
  private apiKey: string | null = null;
  private provider: 'openai' | 'anthropic' = 'openai';

  constructor() {
    // Initialize with environment variables - prefer OpenRouter
    this.apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || null;
    this.provider = process.env.OPENROUTER_API_KEY ? 'openai' : (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
  }

  /**
   * Generate content based on parameters
   */
  async generateContent(params: {
    platform: string;
    persona?: ContentPersona;
    topic: string;
    hookType?: string;
    tone?: string;
    includeHashtags?: boolean;
    includeEmojis?: boolean;
    targetLength?: 'short' | 'medium' | 'long';
  }) {
    const {
      platform,
      persona,
      topic,
      hookType = 'general',
      tone = 'casual',
      includeHashtags = true,
      includeEmojis = true,
      targetLength = 'medium',
    } = params;

    try {
      // Get platform requirements
      const requirements = PLATFORM_REQUIREMENTS[platform as keyof typeof PLATFORM_REQUIREMENTS];
      
      // Generate content structure
      const structure = this.generateContentStructure(hookType, topic);
      
      // Apply persona voice if provided
      const voicedContent = persona 
        ? await this.applyPersonaVoice(structure, persona)
        : structure;
      
      // Optimize for platform
      const optimizedContent = this.optimizeForPlatform(voicedContent, platform, requirements);
      
      // Add hashtags and emojis
      const finalContent = this.enhanceContent(
        optimizedContent,
        { includeHashtags, includeEmojis, platform }
      );
      
      // Generate variations
      const variations = await this.generateVariations(finalContent, 3);
      
      return {
        primary: finalContent,
        variations,
        metadata: {
          platform,
          hookType,
          tone,
          persona: persona?.name || 'default',
          length: finalContent.length,
          hashtags: this.extractHashtags(finalContent),
          estimatedEngagement: this.predictEngagement(finalContent, platform),
        },
      };
    } catch (error) {
      console.error('Content generation error:', error);
      throw error;
    }
  }

  /**
   * Generate content structure based on hook type
   */
  private generateContentStructure(hookType: string, topic: string): string {
    const templates = CONTENT_TEMPLATES[hookType as keyof typeof CONTENT_TEMPLATES] || CONTENT_TEMPLATES.question;
    
    // Select random templates
    const starter = this.selectRandom(templates.starters);
    const middle = this.selectRandom(templates.middles);
    const ending = this.selectRandom(templates.endings);
    
    // Build content
    let content = starter.replace('{topic}', topic);
    content += '\n\n' + middle;
    content += '\n\n' + ending;
    
    // Replace placeholder variables
    content = this.replacePlaceholders(content, { topic });
    
    return content;
  }

  /**
   * Apply persona voice to content
   */
  private async applyPersonaVoice(content: string, persona: ContentPersona): Promise<string> {
    // Use AI to rewrite in persona's voice if available
    if (this.apiKey && persona?.attributes) {
      const prompt = `Rewrite the following content in a ${persona.attributes.tone} tone with a ${persona.attributes.style} style:

"${content}"

Maintain the core message but adapt the voice to be ${persona.attributes.emotion}.`;
      
      try {
        const aiRewrite = await this.generateWithAI(prompt, 300);
        if (aiRewrite && !aiRewrite.includes('mock')) {
          return aiRewrite;
        }
      } catch (error) {
        console.error('Persona voice AI error:', error);
      }
    }
    
    let voicedContent = content;
    
    // Apply tone transformations
    switch (persona.attributes?.tone) {
      case 'Professional':
        voicedContent = this.makeProfessional(voicedContent);
        break;
      case 'Casual':
        voicedContent = this.makeCasual(voicedContent);
        break;
      case 'Authoritative':
        voicedContent = this.makeAuthoritative(voicedContent);
        break;
    }
    
    // Apply style transformations
    switch (persona.attributes?.style) {
      case 'Formal':
        voicedContent = this.makeFormal(voicedContent);
        break;
      case 'Conversational':
        voicedContent = this.makeConversational(voicedContent);
        break;
      case 'Thought-provoking':
        voicedContent = this.makeThoughtProvoking(voicedContent);
        break;
    }
    
    return voicedContent;
  }

  /**
   * Optimize content for specific platform
   */
  private optimizeForPlatform(content: string, platform: string, requirements: PlatformRequirements): string {
    let optimized = content;
    
    // Enforce length limits
    if (optimized.length > requirements.maxLength) {
      optimized = this.truncateSmartly(optimized, requirements.maxLength);
    }
    
    // Platform-specific optimizations
    switch (platform) {
      case 'twitter':
        // Add thread markers if content is long
        if (optimized.length > 250) {
          optimized += '\n\n🧵 Thread below...';
        }
        break;
      
      case 'linkedin':
        // Add professional CTA
        if (!optimized.includes('connect') && !optimized.includes('message')) {
          optimized += '\n\n💼 Let\'s connect and discuss!';
        }
        break;
      
      case 'instagram':
        // Format for Instagram's algorithm
        optimized = this.formatForInstagram(optimized);
        break;
      
      case 'tiktok':
        // Add trending sounds/challenges reference
        optimized = '🎵 ' + optimized + '\n\n#fyp #foryoupage';
        break;
    }
    
    return optimized;
  }

  /**
   * Enhance content with hashtags and emojis
   */
  private enhanceContent(content: string, options: ContentEnhanceOptions): string {
    let enhanced = content;
    
    if (options.includeEmojis && !this.hasEmojis(enhanced)) {
      enhanced = this.addEmojis(enhanced);
    }
    
    if (options.includeHashtags && !this.hasHashtags(enhanced)) {
      enhanced = this.addHashtags(enhanced, options.platform);
    }
    
    return enhanced;
  }

  /**
   * Generate content variations
   */
  private async generateVariations(content: string, count: number): Promise<string[]> {
    const variations: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // In production, use AI API for variations
      // For now, create simple variations
      let variation = content;
      
      // Variation strategies
      switch (i) {
        case 0:
          // Question variation
          variation = this.convertToQuestion(content);
          break;
        case 1:
          // Emoji variation
          variation = this.varyEmojis(content);
          break;
        case 2:
          // Structure variation
          variation = this.reorderContent(content);
          break;
      }
      
      variations.push(variation);
    }
    
    return variations;
  }

  /**
   * Generate AI-powered content using API
   */
  async generateWithAI(prompt: string, maxTokens: number = 500): Promise<string> {
    if (!this.apiKey) {
      // Return mock AI-generated content
      return this.generateMockAIContent(prompt);
    }

    try {
      if (this.provider === 'openai') {
        return await this.generateWithOpenAI(prompt, maxTokens);
      } else {
        return await this.generateWithAnthropic(prompt, maxTokens);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      return this.generateMockAIContent(prompt);
    }
  }

  /**
   * Generate content with OpenAI via OpenRouter
   */
  private async generateWithOpenAI(prompt: string, maxTokens: number): Promise<string> {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return this.generateMockAIContent(prompt);
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://synthex.app',
          'X-Title': 'SYNTHEX Content Generator'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a viral content creator specializing in social media marketing. Generate engaging, platform-optimized content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.8,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || this.generateMockAIContent(prompt);
    } catch (error) {
      console.error('OpenRouter API error:', error);
      return this.generateMockAIContent(prompt);
    }
  }

  /**
   * Generate content with Anthropic via OpenRouter
   */
  private async generateWithAnthropic(prompt: string, maxTokens: number): Promise<string> {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return this.generateMockAIContent(prompt);
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://synthex.app',
          'X-Title': 'SYNTHEX Content Generator'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-opus',
          messages: [
            {
              role: 'system',
              content: 'You are a viral content creator specializing in social media marketing. Generate engaging, platform-optimized content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || this.generateMockAIContent(prompt);
    } catch (error) {
      console.error('OpenRouter API error:', error);
      return this.generateMockAIContent(prompt);
    }
  }

  /**
   * Generate mock AI content for development
   */
  private generateMockAIContent(prompt: string): string {
    const mockResponses = [
      "🚀 Just discovered the secret to {topic} success: consistency beats perfection every time. Start small, stay focused, and watch the compound effect work its magic. What's your take on this approach?",
      "Unpopular opinion: {topic} isn't about talent, it's about showing up when you don't feel like it. I've seen this play out countless times. The winners aren't the most gifted - they're the most persistent.",
      "Story time: Last year, {topic} seemed impossible. Today, it's my reality. The difference? I stopped waiting for the 'perfect moment' and started with what I had. Your turn - what's holding you back?",
    ];
    
    const response = this.selectRandom(mockResponses);
    return response.replace('{topic}', prompt.slice(0, 50));
  }

  // Helper methods
  private selectRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private replacePlaceholders(content: string, data: PlaceholderData): string {
    let result = content;
    
    // Replace topic
    result = result.replace(/{topic}/g, data.topic);
    
    // Replace other common placeholders
    result = result.replace(/{number}/g, String(Math.floor(Math.random() * 5) + 3));
    result = result.replace(/{adjective}/g, this.selectRandom(['amazing', 'incredible', 'unexpected', 'surprising']));
    result = result.replace(/{timeframe}/g, this.selectRandom(['3 months', '6 months', '1 year', '2 years']));
    
    return result;
  }

  private truncateSmartly(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    // Try to cut at sentence boundary
    const sentences = content.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length < maxLength - 3) {
        truncated += sentence + '. ';
      } else {
        break;
      }
    }
    
    return truncated.trim() || content.substring(0, maxLength - 3) + '...';
  }

  private hasEmojis(content: string): boolean {
    return /[\u{1F300}-\u{1F9FF}]/u.test(content);
  }

  private hasHashtags(content: string): boolean {
    return /#\w+/.test(content);
  }

  private addEmojis(content: string): string {
    const emojis = ['🚀', '💡', '✨', '🔥', '💪', '🎯', '📈', '💼', '🌟', '⚡'];
    const emoji = this.selectRandom(emojis);
    return emoji + ' ' + content;
  }

  private addHashtags(content: string, platform: string): string {
    const hashtags = {
      twitter: ['#growth', '#startup', '#entrepreneur', '#motivation', '#success'],
      linkedin: ['#leadership', '#innovation', '#business', '#career', '#networking'],
      instagram: ['#instagood', '#motivation', '#lifestyle', '#inspiration', '#goals'],
      tiktok: ['#fyp', '#foryou', '#viral', '#trending', '#foryoupage'],
      facebook: ['#community', '#share', '#inspiration', '#life', '#motivation'],
    };
    
    const platformTags = hashtags[platform as keyof typeof hashtags] || hashtags.twitter;
    const selectedTags = platformTags.slice(0, 3).join(' ');
    
    return content + '\n\n' + selectedTags;
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#\w+/g) || [];
    return matches.map(tag => tag.toLowerCase());
  }

  private predictEngagement(content: string, platform: string): number {
    // Simple engagement prediction based on content characteristics
    let score = 50; // Base score
    
    // Boost for questions
    if (content.includes('?')) score += 10;
    
    // Boost for emojis
    if (this.hasEmojis(content)) score += 5;
    
    // Boost for hashtags
    if (this.hasHashtags(content)) score += 5;
    
    // Boost for optimal length
    const optimalLength = { twitter: 100, linkedin: 150, instagram: 125, tiktok: 80, facebook: 100 };
    const optimal = optimalLength[platform as keyof typeof optimalLength] || 100;
    if (Math.abs(content.length - optimal) < 50) score += 10;
    
    // Boost for CTAs
    if (/share|comment|follow|like|save/i.test(content)) score += 10;
    
    return Math.min(score, 100);
  }

  // Tone transformation methods
  private makeProfessional(content: string): string {
    return content
      .replace(/hey/gi, 'Hello')
      .replace(/guys/gi, 'everyone')
      .replace(/awesome/gi, 'excellent')
      .replace(/cool/gi, 'interesting');
  }

  private makeCasual(content: string): string {
    return content
      .replace(/Hello/g, 'Hey')
      .replace(/everyone/gi, 'folks')
      .replace(/excellent/gi, 'awesome')
      .replace(/Therefore/gi, 'So');
  }

  private makeAuthoritative(content: string): string {
    return 'Research shows: ' + content;
  }

  private makeFormal(content: string): string {
    return content.replace(/can't/g, 'cannot').replace(/won't/g, 'will not');
  }

  private makeConversational(content: string): string {
    if (!content.startsWith('You know')) {
      return 'You know what? ' + content;
    }
    return content;
  }

  private makeThoughtProvoking(content: string): string {
    if (!content.startsWith('What if')) {
      return 'What if I told you... ' + content;
    }
    return content;
  }

  private formatForInstagram(content: string): string {
    // Instagram-specific formatting
    const lines = content.split('\n');
    return lines.join('\n.\n'); // Add line breaks with dots
  }

  private convertToQuestion(content: string): string {
    if (content.includes('?')) return content;
    return content.replace(/\.$/, '?');
  }

  private varyEmojis(content: string): string {
    const emojiMap: Record<string, string> = {
      '🚀': '⚡',
      '💡': '✨',
      '🔥': '💪',
      '📈': '📊',
      '❤️': '💖',
    };
    
    let varied = content;
    Object.entries(emojiMap).forEach(([original, replacement]) => {
      varied = varied.replace(new RegExp(original, 'g'), replacement);
    });
    
    return varied;
  }

  private reorderContent(content: string): string {
    const parts = content.split('\n\n');
    if (parts.length < 2) return content;
    
    // Move last part to beginning
    const reordered = [parts[parts.length - 1], ...parts.slice(0, -1)];
    return reordered.join('\n\n');
  }
}

// Export singleton instance
export const contentGenerator = new ContentGeneratorService();