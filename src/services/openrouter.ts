import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// OpenRouter client configuration
const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Available OpenRouter models
export const OPENROUTER_MODELS = {
  HORIZON_ALPHA: 'openrouter/horizon-alpha',
  HORIZON_BETA: 'openrouter/horizon-beta',
  CYPHER_ALPHA: 'openrouter/cypher-alpha',
  OPTIMUS_ALPHA: 'openrouter/optimus-alpha',
  QUASAR_ALPHA: 'openrouter/quasar-alpha',
  AUTO_ROUTER: 'openrouter/auto',
  GPT_4_TURBO: 'openai/gpt-4-turbo',
  CLAUDE_3_SONNET: 'anthropic/claude-3-sonnet',
  GEMINI_PRO: 'google/gemini-pro',
} as const;

// Type definitions
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export class OpenRouterService {
  private defaultClient: OpenAI;
  private defaultModel: string;
  private siteUrl: string;
  private siteName: string;

  constructor() {
    this.defaultClient = openrouter;
    this.defaultModel = OPENROUTER_MODELS.HORIZON_BETA;
    this.siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
    this.siteName = process.env.OPENROUTER_SITE_NAME || 'Auto Marketing Agent';
  }

  /**
   * Create a client instance with user-specific API key
   */
  private createUserClient(apiKey: string): OpenAI {
    return new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });
  }

  /**
   * Check if OpenRouter is properly configured (system-wide)
   */
  isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY && 
           process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
  }

  /**
   * Check if user has configured their own API key
   */
  isUserConfigured(apiKey?: string): boolean {
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * Send a chat completion request to OpenRouter with user or system API key
   */
  async chat(
    messages: OpenRouterMessage[],
    options: OpenRouterOptions = {},
    userApiKey?: string
  ): Promise<OpenRouterResponse> {
    let client: OpenAI;
    
    if (userApiKey && this.isUserConfigured(userApiKey)) {
      client = this.createUserClient(userApiKey);
    } else if (this.isConfigured()) {
      client = this.defaultClient;
    } else {
      throw new Error('OpenRouter API key not configured. Please add your API key in your account settings.');
    }

    try {
      const response = await client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
      }, {
        headers: {
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
      });

      return response as OpenRouterResponse;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw new Error(`OpenRouter request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate marketing content using Horizon Alpha
   */
  async generateMarketingContent(
    prompt: string,
    contentType: 'social_post' | 'email' | 'blog' | 'ad_copy' | 'general' = 'general',
    options: OpenRouterOptions = {},
    userApiKey?: string
  ): Promise<string> {
    const systemPrompts = {
      social_post: 'You are a social media marketing expert. Create engaging, concise social media posts that drive engagement and conversions.',
      email: 'You are an email marketing specialist. Write compelling email content that drives opens, clicks, and conversions.',
      blog: 'You are a content marketing expert. Write informative, SEO-optimized blog content that provides value to readers.',
      ad_copy: 'You are an advertising copywriter. Create persuasive ad copy that drives clicks and conversions.',
      general: 'You are a marketing expert. Create high-quality marketing content that engages audiences and drives results.',
    };

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompts[contentType],
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.chat(messages, {
      ...options,
      model: options.model || OPENROUTER_MODELS.HORIZON_BETA,
    }, userApiKey);

    return response.choices[0]?.message?.content || 'No response generated';
  }

  /**
   * Analyze and optimize existing marketing content
   */
  async optimizeContent(
    content: string,
    platform: string = 'general',
    goals: string[] = ['engagement', 'conversions'],
    userApiKey?: string
  ): Promise<{
    analysis: string;
    optimizedContent: string;
    suggestions: string[];
  }> {
    const prompt = `
Analyze and optimize the following marketing content for ${platform}:

Original Content:
"${content}"

Goals: ${goals.join(', ')}

Please provide:
1. Analysis of the current content
2. Optimized version of the content
3. Specific suggestions for improvement

Format your response as a valid JSON object with exactly these keys:
{
  "analysis": "your analysis here",
  "optimizedContent": "your optimized content here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}
`;

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: 'You are a marketing optimization expert. Analyze content and provide actionable improvements. ALWAYS respond with valid JSON format.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.chat(messages, {
      model: OPENROUTER_MODELS.HORIZON_BETA,
      temperature: 0.3, // Lower temperature for analysis
    }, userApiKey);

    const rawContent = response.choices[0]?.message?.content || '';
    
    try {
      // Try multiple JSON extraction methods
      let jsonString = rawContent;
      
      // Method 1: Extract from markdown code blocks
      const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
      }
      
      // Method 2: Extract JSON object pattern
      const jsonObjectMatch = rawContent.match(/\{[\s\S]*"analysis"[\s\S]*"optimizedContent"[\s\S]*"suggestions"[\s\S]*\}/);
      if (jsonObjectMatch && !codeBlockMatch) {
        jsonString = jsonObjectMatch[0];
      }
      
      // Clean up common issues
      jsonString = jsonString
        .trim()
        .replace(/^\s*```\s*json?\s*/gi, '')
        .replace(/\s*```\s*$/gi, '')
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      const result = JSON.parse(jsonString);
      
      // Validate the structure
      if (!result.analysis || !result.optimizedContent || !Array.isArray(result.suggestions)) {
        throw new Error('Invalid response structure');
      }
      
      return {
        analysis: String(result.analysis),
        optimizedContent: String(result.optimizedContent),
        suggestions: result.suggestions.map((s: any) => String(s)),
      };
    } catch (error) {
      // Enhanced fallback: Try to extract information from unstructured response
      console.warn('Failed to parse JSON response, attempting enhanced fallback extraction');
      
      // More robust section extraction
      const sections: any = {};
      
      // Extract analysis
      const analysisPatterns = [
        /["']?analysis["']?\s*:\s*["']?(.*?)["']?\s*(?=,\s*["']?optimized|$)/is,
        /analysis[:\s]+(.*?)(?=optimized|suggestions|$)/is,
        /1\.\s*analysis[:\s]+(.*?)(?=2\.|optimized|$)/is
      ];
      
      for (const pattern of analysisPatterns) {
        const match = rawContent.match(pattern);
        if (match) {
          sections.analysis = match[1].trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
      
      // Extract optimized content
      const optimizedPatterns = [
        /["']?optimizedContent["']?\s*:\s*["']?(.*?)["']?\s*(?=,\s*["']?suggestions|$)/is,
        /optimized\s*(?:content|version)?[:\s]+(.*?)(?=suggestions|3\.|$)/is,
        /2\.\s*optimized[:\s]+(.*?)(?=3\.|suggestions|$)/is
      ];
      
      for (const pattern of optimizedPatterns) {
        const match = rawContent.match(pattern);
        if (match) {
          sections.optimizedContent = match[1].trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
      
      // Extract suggestions
      const suggestionsPatterns = [
        /["']?suggestions["']?\s*:\s*\[(.*?)\]/is,
        /suggestions?[:\s]+(.*?)$/is,
        /3\.\s*(?:specific\s*)?suggestions?[:\s]+(.*?)$/is
      ];
      
      for (const pattern of suggestionsPatterns) {
        const match = rawContent.match(pattern);
        if (match) {
          const suggestionText = match[1];
          // Parse array-like content or bullet points
          if (suggestionText.includes('"')) {
            sections.suggestions = suggestionText
              .match(/"([^"]+)"/g)
              ?.map(s => s.replace(/"/g, '')) || [];
          } else {
            sections.suggestions = suggestionText
              .split(/[,\n]/)
              .filter(s => s.trim())
              .map(s => s.replace(/^[-*•\d.)\s]+/, '').trim());
          }
          break;
        }
      }
      
      return {
        analysis: sections.analysis || `Content analysis: The ${platform} content focuses on ${goals.join(' and ')}. Further optimization can enhance its effectiveness.`,
        optimizedContent: sections.optimizedContent || content,
        suggestions: sections.suggestions && sections.suggestions.length > 0 
          ? sections.suggestions 
          : [
              'Use stronger action verbs',
              'Add social proof or testimonials',
              'Include a clear call-to-action'
            ],
      };
    }
  }

  /**
   * Generate multiple content variations
   */
  async generateVariations(
    prompt: string,
    count: number = 3,
    contentType: 'social_post' | 'email' | 'blog' | 'ad_copy' = 'social_post',
    userApiKey?: string
  ): Promise<string[]> {
    const variations: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const content = await this.generateMarketingContent(
          `${prompt} (Variation ${i + 1} - make it unique and creative)`,
          contentType,
          { temperature: 0.8 + (i * 0.1) }, // Increase randomness for each variation
          userApiKey
        );
        variations.push(content);
      } catch (error) {
        console.error(`Error generating variation ${i + 1}:`, error);
        variations.push(`Error generating variation ${i + 1}`);
      }
    }

    return variations;
  }

  /**
   * Get model information and pricing
   */
  getModelInfo(model: string = this.defaultModel) {
    const modelInfo: Record<string, {
      name: string;
      description: string;
      context: string;
      pricing: string;
      strengths: string[];
    }> = {
      [OPENROUTER_MODELS.HORIZON_ALPHA]: {
        name: 'Horizon Alpha',
        description: 'Cloaked model for community feedback, free during testing',
        context: '256k tokens',
        pricing: 'Free during testing period',
        strengths: ['General purpose', 'Community feedback', 'High context'],
      },
      [OPENROUTER_MODELS.HORIZON_BETA]: {
        name: 'Horizon Beta',
        description: 'Improved version of Horizon Alpha',
        context: '256k tokens',
        pricing: 'Free during testing period',
        strengths: ['Improved performance', 'General purpose'],
      },
      [OPENROUTER_MODELS.AUTO_ROUTER]: {
        name: 'Auto Router',
        description: 'Automatically routes to best model for your prompt',
        context: 'Variable',
        pricing: 'Variable based on routed model',
        strengths: ['Automatic optimization', 'Best performance'],
      },
    };

    return modelInfo[model] || { 
      name: 'Unknown Model', 
      description: 'No information available',
      context: 'Unknown',
      pricing: 'Unknown',
      strengths: ['Unknown'],
    };
  }
}

// Export singleton instance
export const openRouterService = new OpenRouterService();
