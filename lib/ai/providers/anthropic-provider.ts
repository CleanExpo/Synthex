/**
 * Anthropic AI Provider (Direct)
 *
 * Uses the Anthropic SDK directly, bypassing OpenRouter.
 * Useful when you want a direct connection to Claude models.
 *
 * ENVIRONMENT VARIABLES:
 * - ANTHROPIC_API_KEY: Anthropic API key (SECRET)
 */

import { logger } from '@/lib/logger';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';

export class AnthropicProvider implements AIProvider {
  readonly name = 'Anthropic';

  readonly models: ModelPresets = {
    fast: 'claude-3-haiku-20240307',
    balanced: 'claude-3-5-sonnet-20241022',
    creative: 'claude-3-5-sonnet-20241022',
    premium: 'claude-3-opus-20240229',
    code: 'claude-3-5-sonnet-20241022',
    free: 'claude-3-haiku-20240307',
  };

  private apiKey: string;
  private baseURL = 'https://api.anthropic.com/v1';

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Anthropic API key not configured.');
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Separate system message from conversation messages
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const conversationMsgs = request.messages.filter((m) => m.role !== 'system');

    try {
      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.max_tokens || 1024,
        messages: conversationMsgs.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };
      if (systemMsg) body.system = systemMsg.content;
      if (request.temperature !== undefined)
        body.temperature = request.temperature;
      if (request.top_p !== undefined) body.top_p = request.top_p;

      const res = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        logger.error('Anthropic API error', { status: res.status, body: errBody });
        throw new Error(
          (errBody as any)?.error?.message || `Anthropic API error ${res.status}`
        );
      }

      const data = await res.json();

      // Map Anthropic response to our unified format
      const content =
        data.content
          ?.filter((c: { type: string }) => c.type === 'text')
          .map((c: { type: string; text?: string }) => c.text)
          .join('') || '';

      return {
        id: data.id,
        model: data.model,
        choices: [
          {
            message: { role: 'assistant', content },
            finish_reason: data.stop_reason || 'stop',
          },
        ],
        usage: data.usage
          ? {
              prompt_tokens: data.usage.input_tokens,
              completion_tokens: data.usage.output_tokens,
              total_tokens:
                data.usage.input_tokens + data.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error instanceof Error ? error.message : String(error).includes('Anthropic API')) {
        throw error;
      }
      logger.error('Anthropic provider error', { error });
      throw new Error('Failed to connect to Anthropic API');
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const systemMsg = request.messages.find((m) => m.role === 'system');
    const conversationMsgs = request.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.max_tokens || 1024,
      stream: true,
      messages: conversationMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
    if (systemMsg) body.system = systemMsg.content;
    if (request.temperature !== undefined)
      body.temperature = request.temperature;

    const res = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Anthropic streaming error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (
              event.type === 'content_block_delta' &&
              event.delta?.type === 'text_delta'
            ) {
              yield event.delta.text;
            }
          } catch {
            // Malformed SSE frame, skip to next
          }
        }
      }
    }
  }
}
