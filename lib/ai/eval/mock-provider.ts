/**
 * Mocked AIProvider for the offline eval harness.
 *
 * Implements the same `AIProvider` interface as the real OpenAI / OpenRouter
 * providers (lib/ai/providers/base-provider.ts) but returns FIXED canned
 * content from an in-memory table — NO network, NO API key, NO cost. This is
 * what lets the harness run deterministically in CI.
 *
 * Lookup strategy: each request carries a marker (the golden-case id) so the
 * provider can return the right canned output. The runner injects the id via
 * the system message; see resolveCaseId().
 */

import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  ModelPresets,
} from '../providers/base-provider';

/** Marker prefix the runner embeds in the system message to select an output. */
export const CASE_MARKER = 'EVAL_CASE_ID:';

/** Extract the golden-case id from a request's messages, if present. */
export function resolveCaseId(request: AICompletionRequest): string | null {
  for (const message of request.messages) {
    const idx = message.content.indexOf(CASE_MARKER);
    if (idx !== -1) {
      return message.content.slice(idx + CASE_MARKER.length).trim();
    }
  }
  return null;
}

/**
 * Deterministic, offline AIProvider. Returns the canned output mapped to the
 * request's embedded case id. Falls back to an empty string for unknown ids
 * (which the scorer will flag via the non-empty check).
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'MockEval';

  readonly models: ModelPresets = {
    fast: 'mock-fast',
    balanced: 'mock-balanced',
    creative: 'mock-creative',
    premium: 'mock-premium',
    code: 'mock-code',
    free: 'mock-free',
  };

  /** caseId -> canned completion content. */
  private readonly outputs: Record<string, string>;

  constructor(outputs: Record<string, string>) {
    this.outputs = outputs;
  }

  async complete(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const caseId = resolveCaseId(request);
    const content = caseId !== null ? (this.outputs[caseId] ?? '') : '';
    return {
      id: `mock-${caseId ?? 'unknown'}`,
      model: request.model,
      choices: [
        {
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  async *stream(
    request: AICompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    const response = await this.complete(request);
    yield response.choices[0]?.message?.content ?? '';
  }
}
