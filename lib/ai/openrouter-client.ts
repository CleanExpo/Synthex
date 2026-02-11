/**
 * OpenRouter Client (Legacy)
 *
 * Prefer using the provider abstraction instead:
 *   import { getAIProvider } from '@/lib/ai/providers';
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key for AI operations (SECRET)
 * - OPENROUTER_SITE_NAME: Your app name for OpenRouter (PUBLIC)
 * - OPENROUTER_SITE_URL: Your app URL for OpenRouter (PUBLIC)
 *
 * FAILURE MODE: Service will fail gracefully with error messages
 */

import axios from 'axios';
import { logger } from '@/lib/logger';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  
  // Available models for different use cases
  public models = {
    // Fast and cheap for simple tasks
    fast: 'openai/gpt-3.5-turbo',
    
    // Balanced performance and cost
    balanced: 'anthropic/claude-3-haiku',
    
    // High quality for complex tasks
    creative: 'anthropic/claude-3-sonnet',
    
    // Best quality but expensive
    premium: 'openai/gpt-4-turbo',
    
    // Specialized for code
    code: 'deepseek/deepseek-coder',
    
    // Free tier option
    free: 'google/gemini-flash-1.5-8b'
  };

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not configured. AI features will be limited.');
    }
  }

  /**
   * Make a completion request to OpenRouter
   */
  async complete(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          ...request,
          // Add site info for OpenRouter tracking
          transforms: ['middle-out'],
          route: 'fallback'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app',
            'X-Title': process.env.OPENROUTER_SITE_NAME || 'SYNTHEX',
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number; data: { error?: { message?: string } } }; request?: unknown };
      if (axiosError.response) {
        logger.error('OpenRouter API error', { status: axiosError.response.status, data: axiosError.response.data });
        throw new Error(axiosError.response.data.error?.message || 'OpenRouter API request failed');
      } else if (axiosError.request) {
        logger.error('OpenRouter network error', { error });
        throw new Error('Network error connecting to OpenRouter');
      } else {
        logger.error('OpenRouter error', { error });
        throw error;
      }
    }
  }

  /**
   * Generate content with streaming support
   */
  async *stream(request: OpenRouterRequest): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        ...request,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'SYNTHEX',
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Check available models and pricing
   */
  async getModels() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch models', { error });
      return null;
    }
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    // Approximate pricing per 1M tokens (check OpenRouter for latest)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
      'openai/gpt-4-turbo': { prompt: 10, completion: 30 },
      'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
      'anthropic/claude-3-sonnet': { prompt: 3, completion: 15 },
      'google/gemini-flash-1.5-8b': { prompt: 0, completion: 0 }, // Free tier
      'deepseek/deepseek-coder': { prompt: 0.14, completion: 0.28 }
    };

    const modelPricing = pricing[model] || { prompt: 1, completion: 2 };
    
    const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;
    
    return promptCost + completionCost;
  }
}

// Export singleton instance
export const openRouterClient = new OpenRouterClient();