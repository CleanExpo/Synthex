/**
 * Base AI Provider Interface
 *
 * All AI providers (OpenRouter, Anthropic, Google) implement this interface
 * so the rest of the codebase can swap providers via the AI_PROVIDER env var.
 *
 * ENVIRONMENT VARIABLES:
 * - AI_PROVIDER: Which provider to use (PUBLIC, optional, defaults to "openrouter")
 *   Valid values: "openrouter" | "anthropic" | "google"
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface AICompletionResponse {
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

/** Preset model aliases for different use-case tiers. */
export interface ModelPresets {
  fast: string;
  balanced: string;
  creative: string;
  premium: string;
  code: string;
  free: string;
}

export interface AIProvider {
  /** Human-readable provider name (e.g. "OpenRouter", "Anthropic"). */
  readonly name: string;

  /** Preset model identifiers for quick selection. */
  readonly models: ModelPresets;

  /** Send a chat completion request and return the full response. */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /** Stream a chat completion, yielding content tokens. */
  stream(request: AICompletionRequest): AsyncGenerator<string, void, unknown>;
}
