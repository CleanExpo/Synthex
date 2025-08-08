/**
 * AI Integration Library
 * Handles OpenAI and other AI service integrations
 */

import OpenAI from 'openai';

// AI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize OpenAI client
const openai = OPENAI_API_KEY ? new OpenAI({
  apiKey: OPENAI_API_KEY
}) : null;

// Platform-specific prompts
const PLATFORM_PROMPTS = {
  instagram: {
    systemPrompt: `You are an Instagram content optimization expert. Create engaging, visual-first content that maximizes Instagram engagement. Focus on:
    - Visual storytelling
    - Hashtag optimization (10-30 relevant hashtags)
    - Stories and Reels potential
    - Community engagement
    - Instagram algorithm best practices`,
    
    contentTypes: ['post', 'story', 'reel', 'carousel'],
    
    optimizationFocus: [
      'Visual appeal and aesthetics',
      'Hashtag strategy for discovery',
      'Engagement-driving captions',
      'Story/Reel content ideas',
      'Best posting times'
    ]
  },
  
  facebook: {
    systemPrompt: `You are a Facebook content optimization expert. Create content that drives meaningful engagement and builds community. Focus on:
    - Community building and discussion
    - Native video optimization
    - Facebook algorithm preferences
    - Group and page strategies
    - Local business engagement`,
    
    contentTypes: ['post', 'video', 'event', 'poll'],
    
    optimizationFocus: [
      'Community engagement',
      'Native video performance',
      'Discussion starters',
      'Facebook Groups strategy',
      'Local business optimization'
    ]
  },
  
  twitter: {
    systemPrompt: `You are a Twitter/X content optimization expert. Create content that maximizes virality and engagement. Focus on:
    - Thread creation and storytelling
    - Real-time engagement and trends
    - Concise, impactful messaging
    - Twitter Spaces and live features
    - News and trending topics`,
    
    contentTypes: ['tweet', 'thread', 'reply', 'retweet'],
    
    optimizationFocus: [
      'Thread narrative structure',
      'Trending topic integration',
      'Viral content patterns',
      'Real-time engagement',
      'Twitter algorithm optimization'
    ]
  },
  
  linkedin: {
    systemPrompt: `You are a LinkedIn content optimization expert. Create professional content that builds thought leadership and business connections. Focus on:
    - Professional insights and expertise
    - Industry trends and analysis
    - B2B networking and lead generation
    - Career development content
    - Business storytelling`,
    
    contentTypes: ['post', 'article', 'video', 'carousel'],
    
    optimizationFocus: [
      'Thought leadership positioning',
      'Professional networking',
      'Industry expertise',
      'B2B lead generation',
      'Career development insights'
    ]
  },
  
  tiktok: {
    systemPrompt: `You are a TikTok content optimization expert. Create content that maximizes viral potential and engagement. Focus on:
    - Trending sounds and challenges
    - Short-form video optimization
    - Gen Z and millennial audiences
    - Creative and entertaining content
    - TikTok algorithm and FYP strategies`,
    
    contentTypes: ['video', 'duet', 'stitch', 'challenge'],
    
    optimizationFocus: [
      'Viral trend integration',
      'Sound and music selection',
      'Hook creation (first 3 seconds)',
      'Challenge participation',
      'FYP algorithm optimization'
    ]
  }
};

class AIService {
  constructor() {
    this.openai = openai;
    this.rateLimitCache = new Map();
  }

  // Rate limiting check
  checkRateLimit(userId, endpoint) {
    const key = `${userId}-${endpoint}`;
    const now = Date.now();
    const limit = this.rateLimitCache.get(key);

    if (!limit) {
      this.rateLimitCache.set(key, { count: 1, resetTime: now + 60000 });
      return { allowed: true, remaining: 9 };
    }

    if (now > limit.resetTime) {
      this.rateLimitCache.set(key, { count: 1, resetTime: now + 60000 });
      return { allowed: true, remaining: 9 };
    }

    if (limit.count >= 10) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: limit.resetTime,
        message: 'Rate limit exceeded. Try again in a minute.' 
      };
    }

    limit.count++;
    return { allowed: true, remaining: 10 - limit.count };
  }

  // Generate optimized content using AI
  async generateOptimizedContent(platform, originalContent, options = {}) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const platformConfig = PLATFORM_PROMPTS[platform.toLowerCase()];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const {
      tone = 'professional',
      audience = 'general',
      contentType = 'post',
      includeHashtags = true,
      includeEmojis = true,
      maxLength = null
    } = options;

    const prompt = this.buildOptimizationPrompt(
      platformConfig,
      originalContent,
      { tone, audience, contentType, includeHashtags, includeEmojis, maxLength }
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: platformConfig.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const optimizedContent = response.choices[0]?.message?.content;
      if (!optimizedContent) {
        throw new Error('No content generated');
      }

      return this.parseAIResponse(optimizedContent, platform);

    } catch (error) {
      console.error('AI generation error:', error);
      throw new Error('Failed to generate optimized content');
    }
  }

  // Generate hashtags using AI
  async generateHashtags(content, platform, count = 10) {
    if (!this.openai) {
      return this.fallbackHashtagGeneration(content, platform, count);
    }

    const prompt = `Generate ${count} relevant, trending hashtags for this ${platform} content: "${content}". 
    Return only the hashtags, one per line, without explanations. Make them specific and discoverable.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 150
      });

      const hashtags = response.choices[0]?.message?.content
        .split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag.startsWith('#'))
        .slice(0, count);

      return hashtags.length > 0 ? hashtags : this.fallbackHashtagGeneration(content, platform, count);

    } catch (error) {
      return this.fallbackHashtagGeneration(content, platform, count);
    }
  }

  // Generate content ideas using AI
  async generateContentIdeas(platform, topic, count = 5) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const platformConfig = PLATFORM_PROMPTS[platform.toLowerCase()];
    const prompt = `Generate ${count} creative content ideas for ${platform} about "${topic}". 
    Consider ${platformConfig.contentTypes.join(', ')} formats. 
    For each idea, provide: Title, Content Hook, and Key Message. 
    Make them engaging and platform-optimized.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: platformConfig.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800
      });

      return this.parseContentIdeas(response.choices[0]?.message?.content);

    } catch (error) {
      console.error('Content ideas generation error:', error);
      throw new Error('Failed to generate content ideas');
    }
  }

  // Analyze content sentiment and engagement potential
  async analyzeContent(content, platform) {
    if (!this.openai) {
      return this.fallbackAnalysis(content, platform);
    }

    const prompt = `Analyze this ${platform} content for:
    1. Sentiment (positive/negative/neutral)
    2. Engagement potential (1-10 score)
    3. Target audience fit
    4. Key themes and topics
    5. Improvement suggestions
    
    Content: "${content}"
    
    Provide a structured analysis.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400
      });

      return this.parseAnalysisResponse(response.choices[0]?.message?.content);

    } catch (error) {
      return this.fallbackAnalysis(content, platform);
    }
  }

  // Build optimization prompt
  buildOptimizationPrompt(platformConfig, originalContent, options) {
    const { tone, audience, contentType, includeHashtags, includeEmojis, maxLength } = options;

    return `Optimize this content for ${platformConfig.contentTypes[0]} on this platform:

Original Content: "${originalContent}"

Requirements:
- Tone: ${tone}
- Target Audience: ${audience}
- Content Type: ${contentType}
- Include Hashtags: ${includeHashtags ? 'Yes' : 'No'}
- Include Emojis: ${includeEmojis ? 'Yes' : 'No'}
${maxLength ? `- Maximum Length: ${maxLength} characters` : ''}

Focus on: ${platformConfig.optimizationFocus.join(', ')}

Provide the optimized content with brief optimization notes.`;
  }

  // Parse AI response
  parseAIResponse(content, platform) {
    const lines = content.split('\n').filter(line => line.trim());
    
    let optimizedContent = '';
    let hashtags = [];
    let suggestions = [];

    // Extract main content (usually the first substantial block)
    const contentStart = lines.findIndex(line => 
      !line.toLowerCase().includes('optimized') && 
      !line.toLowerCase().includes('hashtag') && 
      line.length > 20
    );

    if (contentStart !== -1) {
      optimizedContent = lines[contentStart];
    }

    // Extract hashtags
    lines.forEach(line => {
      const hashtagMatches = line.match(/#\w+/g);
      if (hashtagMatches) {
        hashtags.push(...hashtagMatches);
      }
    });

    // Extract suggestions (lines that contain optimization keywords)
    suggestions = lines.filter(line => 
      line.toLowerCase().includes('suggestion') ||
      line.toLowerCase().includes('tip') ||
      line.toLowerCase().includes('optimize') ||
      line.toLowerCase().includes('improve')
    );

    return {
      optimizedContent: optimizedContent || content,
      hashtags: [...new Set(hashtags)].slice(0, 20),
      suggestions: suggestions.length > 0 ? suggestions : ['Content optimized for platform best practices'],
      aiGenerated: true
    };
  }

  // Parse content ideas response
  parseContentIdeas(content) {
    const ideas = [];
    const sections = content.split(/\d+\./).filter(s => s.trim());

    sections.forEach(section => {
      const lines = section.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        ideas.push({
          title: lines[0].replace(/^(Title:|Idea:)/i, '').trim(),
          hook: lines.find(l => l.toLowerCase().includes('hook'))?.replace(/^.*hook:?/i, '').trim() || '',
          message: lines.find(l => l.toLowerCase().includes('message'))?.replace(/^.*message:?/i, '').trim() || ''
        });
      }
    });

    return ideas.length > 0 ? ideas : [
      { title: 'Content idea generation failed', hook: 'Please try again', message: 'AI service unavailable' }
    ];
  }

  // Parse analysis response
  parseAnalysisResponse(content) {
    return {
      sentiment: this.extractField(content, 'sentiment') || 'neutral',
      engagementScore: parseInt(this.extractField(content, 'engagement')) || 7,
      targetAudience: this.extractField(content, 'audience') || 'general',
      themes: this.extractField(content, 'themes')?.split(',').map(t => t.trim()) || [],
      suggestions: this.extractField(content, 'suggestions')?.split('.').filter(s => s.trim()) || []
    };
  }

  // Extract field from AI response
  extractField(content, field) {
    const regex = new RegExp(`${field}:?\\s*([^\n]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  // Fallback hashtag generation
  fallbackHashtagGeneration(content, platform, count) {
    const words = content.toLowerCase().split(/\s+/).filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'this', 'that'].includes(word)
    );

    const hashtags = words.slice(0, Math.min(count - 2, words.length))
      .map(word => `#${word}`);

    // Add platform-specific hashtags
    const platformTags = {
      instagram: ['#instagood', '#photooftheday'],
      facebook: ['#community', '#connect'],
      twitter: ['#trending'],
      linkedin: ['#professional', '#business'],
      tiktok: ['#fyp', '#viral']
    };

    return [...hashtags, ...(platformTags[platform] || [])].slice(0, count);
  }

  // Fallback analysis
  fallbackAnalysis(content, platform) {
    const wordCount = content.split(/\s+/).length;
    const hasPositiveWords = /\b(great|amazing|awesome|love|best|excellent)\b/i.test(content);
    const hasNegativeWords = /\b(bad|terrible|awful|hate|worst)\b/i.test(content);

    return {
      sentiment: hasPositiveWords ? 'positive' : hasNegativeWords ? 'negative' : 'neutral',
      engagementScore: Math.min(10, Math.max(5, wordCount / 10 + (hasPositiveWords ? 2 : 0))),
      targetAudience: 'general',
      themes: ['general'],
      suggestions: ['Add more engaging elements', 'Include relevant hashtags', 'Consider visual content']
    };
  }
}

// Create singleton instance
export const aiService = new AIService();

// Export individual functions
export const {
  generateOptimizedContent,
  generateHashtags,
  generateContentIdeas,
  analyzeContent,
  checkRateLimit
} = aiService;

// Export for browser (limited functionality)
if (typeof window !== 'undefined') {
  window.synthexAI = {
    generateHashtags: (content, platform, count) => 
      aiService.fallbackHashtagGeneration(content, platform, count),
    analyzeContent: (content, platform) => 
      aiService.fallbackAnalysis(content, platform)
  };
}