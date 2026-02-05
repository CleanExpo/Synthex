/**
 * OpenRouter AI Provider
 *
 * Wraps the existing OpenRouter integration to conform to the AIProvider interface.
 * This is the default provider and supports 100+ models via a single API key.
 *
 * ENVIRONMENT VARIABLES:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 * - OPENROUTER_SITE_NAME: App name sent to OpenRouter (PUBLIC, optional)
 * - OPENROUTER_SITE_URL: App URL sent to OpenRouter (PUBLIC, optional)
 */

import axios from 'axios';
import { logger } from '@/lib/logger';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'OpenRouter';

  readonly models: ModelPresets = {
    fast: 'openai/gpt-3.5-turbo',
    balanced: 'anthropic/claude-3-haiku',
    creative: 'anthropic/claude-3-sonnet',
    premium: 'openai/gpt-4-turbo',
    code: 'deepseek/deepseek-coder',
    free: 'google/gemini-flash-1.5-8b',
  };

  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not configured. AI features will be limited.');
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          ...request,
          transforms: ['middle-out'],
          route: 'fallback',
        },
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error('OpenRouter API error', {
            status: error.response.status,
            data: error.response.data,
          });
          throw new Error(
            error.response.data?.error?.message || 'OpenRouter API request failed'
          );
        } else if (error.request) {
          logger.error('OpenRouter network error', { error: error.message });
          throw new Error('Network error connecting to OpenRouter');
        }
      }
      throw error;
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      { ...request, stream: true },
      {
        headers: this.getHeaders(),
        responseType: 'stream',
      }
    );

    let buffer = '';
    for await (const chunk of response.data) {
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
          } catch {
            // skip malformed SSE frames
          }
        }
      }
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://synthex.app',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'SYNTHEX',
      'Content-Type': 'application/json',
    };
  }
}
