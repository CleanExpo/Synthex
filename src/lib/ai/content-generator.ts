/**
 * Advanced AI Content Generation System
 * Integrates with OpenRouter for multi-model content creation
 */

// TODO: Create viral-patterns module
// import { viralPatterns } from '@/src/lib/viral-patterns';

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
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private models = {
    creative: 'anthropic/claude-3-opus',
    balanced: 'anthropic/claude-3-sonnet', 
    fast: 'anthropic/claude-3-haiku',
    specialized: 'meta-llama/llama-3-70b-instruct'
  };

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Generate AI content based on request parameters
   */
  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    const startTime = Date.now();
    
    // Build the prompt based on request
    const prompt = this.buildPrompt(request);
    
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
      console.error('Content generation error:', error);
      throw new Error('Failed to generate content');
    }
  }

  /**
   * Build prompt for AI based on request
   */
  private buildPrompt(request: ContentRequest): string {
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

    return `
Generate a ${request.type} for ${request.platform}.

Platform Style: ${platformGuides[request.platform]}
Tone: ${request.tone ? toneGuides[request.tone] : 'balanced'}
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

Generate content that will maximize engagement and shares.
    `.trim();
  }

  /**
   * Call OpenRouter API
   */
  private async callAI(prompt: string, model: string): Promise<string> {
    if (!this.apiKey || this.apiKey === '') {
      // Fallback to template-based generation
      return this.generateFromTemplate(prompt);
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synthex.app',
          'X-Title': 'SYNTHEX Content Generator'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a viral content expert specializing in creating highly engaging social media content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback to template generation
      return this.generateFromTemplate(prompt);
    }
  }

  /**
   * Generate content from templates (fallback)
   */
  private generateFromTemplate(prompt: string): string {
    const templates = {
      twitter: [
        "🚀 {topic} is changing the game! Here's what you need to know:\n\n✅ Key insight 1\n✅ Key insight 2\n✅ Key insight 3\n\nWhat's your take? 👇",
        "Unpopular opinion: {topic} is actually the future.\n\nHere's why (thread) 🧵👇",
        "Just discovered this about {topic} and I'm mind-blown 🤯\n\n{insight}\n\nRT if you agree!"
      ],
      instagram: [
        "✨ {topic} vibes only ✨\n\n{content}\n\n💫 Double tap if you relate\n💬 Share your thoughts below\n👥 Tag someone who needs to see this\n\n#motivation #inspiration #growth",
        "POV: You finally understood {topic} 🎯\n\n{content}\n\nSave this for later! 📌",
        "Stop scrolling! This {topic} tip will change your life 👆\n\n{content}\n\nFollow for more daily wisdom 🌟"
      ],
      linkedin: [
        "🎯 Key Insights on {topic}\n\nAfter years in the industry, here's what I've learned:\n\n1. {point1}\n2. {point2}\n3. {point3}\n\nWhat has been your experience?\n\n#leadership #innovation #growth",
        "The future of {topic} is here, and it's transformative.\n\n{content}\n\nLet's connect to discuss more insights.",
        "3 lessons from implementing {topic}:\n\n📈 {lesson1}\n💡 {lesson2}\n🚀 {lesson3}\n\nWhat would you add?"
      ]
    };

    const platform = prompt.includes('twitter') ? 'twitter' : 
                    prompt.includes('instagram') ? 'instagram' : 'linkedin';
    const template = templates[platform][Math.floor(Math.random() * templates[platform].length)];
    
    return template
      .replace(/{topic}/g, 'innovative strategies')
      .replace(/{content}/g, 'This revolutionary approach is transforming how we think about digital marketing.')
      .replace(/{insight}/g, 'Small consistent actions compound into extraordinary results')
      .replace(/{point1}/g, 'Strategy beats tactics every time')
      .replace(/{point2}/g, 'Data-driven decisions outperform intuition')
      .replace(/{point3}/g, 'Community engagement drives growth')
      .replace(/{lesson1}/g, 'Start small, iterate fast')
      .replace(/{lesson2}/g, 'Listen to your audience')
      .replace(/{lesson3}/g, 'Measure what matters');
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