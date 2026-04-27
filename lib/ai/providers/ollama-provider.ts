/**
 * Ollama Provider
 *
 * Local LLM provider for Gemma 4 E2B / E4B running on the developer machine via
 * the Ollama runtime (default http://localhost:11434).
 *
 * This provider is the zero-cost tier in the Synthex multi-model orchestration
 * matrix (see `lib/ai/task-routing.ts`). Routine intents (classify, extract,
 * format, summarise) route here first; cloud providers act as fallback when the
 * local runtime is unreachable (e.g. on Vercel — Ollama cannot run there).
 *
 * ENVIRONMENT VARIABLES:
 * - OLLAMA_BASE_URL: Ollama runtime URL (PUBLIC, optional, default http://localhost:11434)
 *
 * Critical: Gemma 4 requires `think: false` in the options block. Without this
 * the model burns budget on internal reasoning and returns empty output.
 */

import { logger } from '@/lib/logger';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  ModelPresets,
} from './base-provider';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 60_000;

/** Thrown when the Ollama runtime is unreachable (e.g. not running, prod env). */
export class OllamaUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'OllamaUnavailableError';
  }
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  think?: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
    top_p?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama';

  readonly models: ModelPresets = {
    fast: 'gemma4:e2b',
    balanced: 'gemma4:e4b',
    creative: 'gemma4:e4b', // Gemma is not strong at creative; surface in routing
    premium: 'gemma4:e4b', // local cannot really be "premium" — placeholder
    code: 'gemma4:e4b', // Gemma code quality is mediocre; cloud is preferred
    free: 'gemma4:e2b',
  };

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = (baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Flatten chat-style messages into a single prompt string.
   * Ollama's /api/generate is prompt-based; the chat-style /api/chat exists but
   * we keep the code simple and consistent for Gemma.
   */
  private buildPrompt(request: AICompletionRequest): string {
    return request.messages
      .map(m => {
        if (m.role === 'system') return `[SYSTEM]\n${m.content}`;
        if (m.role === 'user') return `[USER]\n${m.content}`;
        return `[ASSISTANT]\n${m.content}`;
      })
      .join('\n\n')
      .concat('\n\n[ASSISTANT]\n');
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const body: OllamaGenerateRequest = {
      model: request.model || this.models.balanced,
      prompt: this.buildPrompt(request),
      stream: false,
      think: false,
      options: {
        num_predict: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;

      return {
        id: `ollama-${Date.now()}`,
        model: data.model || body.model,
        choices: [
          {
            message: { role: 'assistant', content: data.response ?? '' },
            finish_reason: data.done ? 'stop' : 'length',
          },
        ],
        usage: {
          prompt_tokens: data.prompt_eval_count ?? 0,
          completion_tokens: data.eval_count ?? 0,
          total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e?.code === 'ECONNREFUSED' || e?.name === 'AbortError' || /fetch failed/i.test(e?.message || '')) {
        logger.warn('Ollama unreachable; caller should fall back', {
          baseUrl: this.baseUrl,
          error: e?.message,
        });
        throw new OllamaUnavailableError(`Ollama runtime unreachable at ${this.baseUrl}`, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<string, void, unknown> {
    const body: OllamaGenerateRequest = {
      model: request.model || this.models.balanced,
      prompt: this.buildPrompt(request),
      stream: true,
      think: false,
      options: {
        num_predict: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as OllamaGenerateResponse;
            if (chunk.response) yield chunk.response;
            if (chunk.done) return;
          } catch {
            // ignore malformed line — Ollama occasionally interleaves keepalives
          }
        }
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e?.code === 'ECONNREFUSED' || e?.name === 'AbortError' || /fetch failed/i.test(e?.message || '')) {
        throw new OllamaUnavailableError(`Ollama runtime unreachable at ${this.baseUrl}`, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
