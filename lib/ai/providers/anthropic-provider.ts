/**
 * Anthropic AI Provider (Direct)
 *
 * Uses the Anthropic SDK directly, bypassing OpenRouter.
 * Useful when you want a direct connection to Claude models.
 *
 * Supports adaptive thinking (Claude 4.6+) and prompt caching.
 *
 * ENVIRONMENT VARIABLES:
 * - ANTHROPIC_API_KEY: Anthropic API key (SECRET)
 */

import Anthropic from '@anthropic-ai/sdk';
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
    fast: 'claude-haiku-4-5-20251001',
    balanced: 'claude-sonnet-4-6',
    creative: 'claude-sonnet-4-6',
    premium: 'claude-opus-4-6',
    code: 'claude-sonnet-4-6',
    free: 'claude-haiku-4-5-20251001',
  };

  private client: Anthropic;

  constructor(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      logger.warn('Anthropic API key not configured.');
    }
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Separate system message from conversation messages
    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMsgs = request.messages.filter(m => m.role !== 'system');

    try {
      // Build system parameter — supports prompt caching when request.cache is true
      let systemParam: string | Anthropic.TextBlockParam[] | undefined =
        undefined;

      if (systemMsg) {
        if (request.cache) {
          systemParam = [
            {
              type: 'text',
              text: systemMsg.content,
              cache_control: { type: 'ephemeral' },
            },
          ];
        } else {
          systemParam = systemMsg.content;
        }
      }

      // Build base params without temperature (may be omitted for thinking)
      const baseParams = {
        model: request.model,
        max_tokens: request.max_tokens ?? 1024,
        messages: conversationMsgs.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...(systemParam !== undefined ? { system: systemParam } : {}),
        ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.input_schema as Anthropic.Tool['input_schema'],
              })),
            }
          : {}),
      } satisfies Omit<
        Anthropic.MessageCreateParamsNonStreaming,
        'temperature'
      >;

      // Adaptive thinking (Claude 4.6+) — temperature must be omitted when thinking is enabled
      const useThinking = !!request.thinking;

      const params = (
        useThinking
          ? {
              ...baseParams,
              thinking: {
                type: 'adaptive' as const,
                ...(request.thinkingDisplay === 'omitted'
                  ? { display: 'omitted' as const }
                  : {}),
              },
            }
          : {
              ...baseParams,
              ...(request.temperature !== undefined
                ? { temperature: request.temperature }
                : {}),
            }
      ) as Anthropic.MessageCreateParamsNonStreaming;

      const data = await this.client.messages.create(params);

      // Map Anthropic response to the unified format — extract only text blocks
      const content =
        data.content
          .filter((c): c is Anthropic.TextBlock => c.type === 'text')
          .map(c => c.text)
          .join('') || '';

      return {
        id: data.id,
        model: data.model,
        choices: [
          {
            message: { role: 'assistant', content },
            finish_reason: data.stop_reason ?? 'stop',
          },
        ],
        usage: data.usage
          ? {
              prompt_tokens: data.usage.input_tokens,
              completion_tokens: data.usage.output_tokens,
              total_tokens: data.usage.input_tokens + data.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        logger.error('Anthropic API error', {
          status: error.status,
          message: error.message,
        });
        throw new Error(error.message || `Anthropic API error ${error.status}`);
      }
      logger.error('Anthropic provider error', { error });
      throw new Error('Failed to connect to Anthropic API');
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMsgs = request.messages.filter(m => m.role !== 'system');

    let systemParam: string | Anthropic.TextBlockParam[] | undefined =
      undefined;

    if (systemMsg) {
      if (request.cache) {
        systemParam = [
          {
            type: 'text',
            text: systemMsg.content,
            cache_control: { type: 'ephemeral' },
          },
        ];
      } else {
        systemParam = systemMsg.content;
      }
    }

    const params: Anthropic.MessageStreamParams = {
      model: request.model,
      max_tokens: request.max_tokens ?? 1024,
      messages: conversationMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      ...(systemParam !== undefined ? { system: systemParam } : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    };

    try {
      const streamObj = this.client.messages.stream(params);

      for await (const event of streamObj) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        logger.error('Anthropic streaming error', {
          status: error.status,
          message: error.message,
        });
        throw new Error(
          error.message || `Anthropic streaming error ${error.status}`
        );
      }
      logger.error('Anthropic provider stream error', { error });
      throw new Error('Failed to stream from Anthropic API');
    }
  }
}
