/**
 * Ollama Local AI Provider — SYN-807
 *
 * Wraps a locally-running Ollama daemon for zero-cost inference on the
 * developer laptop. Production deploys (Vercel) cannot run Ollama, so the
 * router upstream of this provider is responsible for falling back to a
 * cloud provider when `OllamaUnavailableError` is thrown.
 *
 * ENVIRONMENT VARIABLES:
 * - OLLAMA_BASE_URL: Base URL of the Ollama API (defaults to http://localhost:11434)
 *   Security: INTERNAL [OPTIONAL — local dev only]
 * - OLLAMA_MODEL: Default model identifier (defaults to gemma4:e2b)
 *   Security: INTERNAL [OPTIONAL]
 *
 * The provider talks to Ollama's native `/api/chat` endpoint (not the
 * OpenAI-compatible `/v1/chat/completions` shim) so we get direct control
 * over Gemma 4's `think` flag — without it the model burns its token
 * budget on internal thinking and returns an empty `message.content`.
 */

import axios, { AxiosError } from 'axios';
import { logger } from '@/lib/logger';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';

/**
 * Thrown when the Ollama daemon is not reachable. Callers (router /
 * fallback chain) should treat this as a signal to escalate to a cloud
 * provider rather than surfacing an opaque network error to the user.
 */
export class OllamaUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'OllamaUnavailableError';
    this.cause = cause;
  }
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  think?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  message?: { role: string; content: string };
  done: boolean;
  done_reason?: string;
}

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama';

  /**
   * Preset model aliases. Local hardware imposes real limits — there is
   * no "premium" tier locally that beats a cloud Sonnet/Opus. The presets
   * below pick the best Gemma 4 size we can actually run on the dev laptop
   * and leave the routing layer (`lib/ai/task-routing.ts`) to escalate to
   * cloud when the task warrants it.
   */
  readonly models: ModelPresets = {
    fast: 'gemma4:e2b',
    balanced: 'gemma4:e4b',
    creative: 'gemma4:e4b',
    premium: 'gemma4:e4b',
    code: 'gemma4:e4b',
    free: 'gemma4:e2b',
  };

  private readonly baseURL: string;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;

  constructor(_apiKeyOverride?: string) {
    // Ollama doesn't authenticate — apiKey override is accepted for
    // factory-signature compatibility but ignored.
    this.baseURL = (
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    ).replace(/\/$/, '');
    this.defaultModel = process.env.OLLAMA_MODEL || 'gemma4:e2b';
    // CPU inference is slow. 90 s covers most batch tasks on the dev
    // laptop; longer-running calls should use the streaming API.
    this.defaultTimeoutMs = 90_000;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const body = this.buildRequest(request, /*stream*/ false);

    try {
      const response = await axios.post<OllamaChatResponse>(
        `${this.baseURL}/api/chat`,
        body,
        {
          timeout: this.defaultTimeoutMs,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = response.data;
      const content = data.message?.content ?? '';
      const promptTokens = data.prompt_eval_count ?? 0;
      const completionTokens = data.eval_count ?? 0;

      return {
        id: `ollama-${Date.now()}`,
        model: data.model ?? body.model,
        choices: [
          {
            message: { role: 'assistant', content },
            finish_reason: data.done_reason ?? 'stop',
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    const body = this.buildRequest(request, /*stream*/ true);

    let response;
    try {
      response = await axios.post(`${this.baseURL}/api/chat`, body, {
        timeout: this.defaultTimeoutMs,
        responseType: 'stream',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      this.handleError(error);
    }

    let buffer = '';
    for await (const chunk of response.data) {
      buffer += chunk.toString();
      // Ollama emits one JSON object per line (no `data: ` prefix).
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as OllamaStreamChunk;
          const content = parsed.message?.content;
          if (content) yield content;
          if (parsed.done) return;
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  /** Convert the generic AICompletionRequest into Ollama's native shape. */
  private buildRequest(
    request: AICompletionRequest,
    stream: boolean
  ): OllamaChatRequest {
    return {
      model: request.model || this.defaultModel,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream,
      // Hard-disable Gemma 4's internal thinking unless the caller has
      // requested it via the Anthropic-style `thinking` field. Without
      // this, Gemma 4 consumes its entire token budget thinking and
      // returns an empty content field.
      think: Boolean(request.thinking),
      options: {
        temperature: request.temperature,
        num_predict: request.max_tokens,
        top_p: request.top_p,
      },
    };
  }

  /** Translate axios errors into typed errors the router can react to. */
  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const ax = error as AxiosError;
      // ECONNREFUSED / ENOTFOUND / etc. — daemon not reachable.
      if (
        !ax.response &&
        (ax.code === 'ECONNREFUSED' ||
          ax.code === 'ENOTFOUND' ||
          ax.code === 'ETIMEDOUT' ||
          ax.message?.includes('connect'))
      ) {
        logger.warn('Ollama daemon unreachable', {
          baseURL: this.baseURL,
          code: ax.code,
        });
        throw new OllamaUnavailableError(
          `Ollama daemon not reachable at ${this.baseURL}`,
          error
        );
      }
      if (ax.response) {
        logger.error('Ollama API error', {
          status: ax.response.status,
          data: ax.response.data,
        });
        const message =
          (ax.response.data as { error?: string } | undefined)?.error ??
          `Ollama API error ${ax.response.status}`;
        throw new Error(message);
      }
    }
    throw error;
  }
}
