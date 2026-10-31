/**
 * OpenAI AI Provider (Direct)
 *
 * Uses the official OpenAI SDK directly (chat completions API), conforming to
 * the shared AIProvider interface so the rest of the codebase can use it via
 * the AI_PROVIDER env var or the per-request user-key path.
 *
 * This is the default provider for Synthex (OpenAI-only direction).
 *
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: OpenAI API key (SECRET)
 * - OPENAI_BASE_URL: Optional override for the API base URL (PUBLIC, optional)
 *
 * Model presets are env-configurable (all optional, sensible OpenAI defaults):
 * - OPENAI_MODEL_FAST      (default: gpt-4o-mini)
 * - OPENAI_MODEL_BALANCED  (default: gpt-4o-mini)
 * - OPENAI_MODEL_CREATIVE  (default: gpt-4o)
 * - OPENAI_MODEL_PREMIUM   (default: gpt-4o)
 * - OPENAI_MODEL_CODE      (default: gpt-4o-mini)
 * - OPENAI_MODEL_FREE      (default: gpt-4o-mini)
 */

import OpenAI, { APIError } from 'openai';
import { logger } from '@/lib/logger';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';
import { withJsonInstruction, attachParsed } from '../structured-output';

/** Default OpenAI model used when no env override is provided. */
const DEFAULT_FAST = 'gpt-4o-mini';
const DEFAULT_BALANCED = 'gpt-4o-mini';
const DEFAULT_CREATIVE = 'gpt-4o';
const DEFAULT_PREMIUM = 'gpt-4o';
const DEFAULT_CODE = 'gpt-4o-mini';
const DEFAULT_FREE = 'gpt-4o-mini';

export class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';

  readonly models: ModelPresets = {
    fast: process.env.OPENAI_MODEL_FAST || DEFAULT_FAST,
    balanced: process.env.OPENAI_MODEL_BALANCED || DEFAULT_BALANCED,
    creative: process.env.OPENAI_MODEL_CREATIVE || DEFAULT_CREATIVE,
    premium: process.env.OPENAI_MODEL_PREMIUM || DEFAULT_PREMIUM,
    code: process.env.OPENAI_MODEL_CODE || DEFAULT_CODE,
    free: process.env.OPENAI_MODEL_FREE || DEFAULT_FREE,
  };

  private client: OpenAI;
  private apiKey: string;

  constructor(apiKeyOverride?: string) {
    this.apiKey = apiKeyOverride || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn(
        'OpenAI API key not configured. AI features will be limited.'
      );
    }
    this.client = new OpenAI({
      apiKey: this.apiKey,
      ...(process.env.OPENAI_BASE_URL
        ? { baseURL: process.env.OPENAI_BASE_URL }
        : {}),
    });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Structured output (SYN-313): OpenAI (via this chat-completions path)
      // has no native `output_config.format`, so degrade to prompt-for-JSON and
      // validate the reply against the schema before returning.
      const outMessages = request.outputFormat
        ? withJsonInstruction(request.messages, request.outputFormat)
        : request.messages;

      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages: outMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...(request.max_tokens !== undefined
          ? { max_tokens: request.max_tokens }
          : {}),
        ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
        ...(request.frequency_penalty !== undefined
          ? { frequency_penalty: request.frequency_penalty }
          : {}),
        ...(request.presence_penalty !== undefined
          ? { presence_penalty: request.presence_penalty }
          : {}),
      });

      const choice = completion.choices[0];
      const result: AICompletionResponse = {
        id: completion.id,
        model: completion.model,
        choices: [
          {
            message: {
              role: choice?.message?.role ?? 'assistant',
              content: choice?.message?.content ?? '',
            },
            finish_reason: choice?.finish_reason ?? 'stop',
          },
        ],
        usage: completion.usage
          ? {
              prompt_tokens: completion.usage.prompt_tokens,
              completion_tokens: completion.usage.completion_tokens,
              total_tokens: completion.usage.total_tokens,
            }
          : undefined,
      };
      return request.outputFormat
        ? attachParsed(result, request.outputFormat)
        : result;
    } catch (error) {
      if (error instanceof APIError) {
        logger.error('OpenAI API error', {
          status: error.status,
          message: error.message,
        });
        throw new Error(error.message || `OpenAI API error ${error.status}`);
      }
      logger.error('OpenAI provider error', { error });
      throw new Error('Failed to connect to OpenAI API');
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const streamObj = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...(request.max_tokens !== undefined
          ? { max_tokens: request.max_tokens }
          : {}),
        ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
        stream: true,
      });

      for await (const chunk of streamObj) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      if (error instanceof APIError) {
        logger.error('OpenAI streaming error', {
          status: error.status,
          message: error.message,
        });
        throw new Error(
          error.message || `OpenAI streaming error ${error.status}`
        );
      }
      logger.error('OpenAI provider stream error', { error });
      throw new Error('Failed to stream from OpenAI API');
    }
  }
}
