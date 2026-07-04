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

/**
 * Provider-agnostic structured-output descriptor (SYN-313).
 *
 * Structurally compatible with the Anthropic SDK's `AutoParseableOutputFormat`
 * (a `JSONOutputFormat` plus a validating `parse`), so it can be handed
 * straight to `messages.parse({ output_config: { format } })`. Non-Anthropic
 * providers reuse the same `parse` to validate a prompt-for-JSON fallback,
 * keeping the shared `complete()` contract intact.
 *
 * Build one with `structuredOutput(zodSchema)` from `lib/ai/structured-output`.
 */
export interface StructuredOutputFormat<T = unknown> {
  type: 'json_schema';
  /** JSON Schema (draft 2020-12) generated from the Zod schema. */
  schema: Record<string, unknown>;
  /** Parse + validate a raw JSON string, throwing on schema mismatch. */
  parse: (content: string) => T;
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
  /** Adaptive thinking effort level (Anthropic only). Falsy = disabled. */
  thinking?: 'low' | 'medium' | 'high' | 'max';
  /** Omit thinking content from response for faster streaming (Anthropic only). */
  thinkingDisplay?: 'omitted';
  /** Enable prompt caching on system prompt (Anthropic only). */
  cache?: boolean;
  /** Tool definitions for tool-use requests. */
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  /**
   * Request a schema-constrained JSON response (SYN-313). When set, the
   * response `parsed` field carries the validated object. Anthropic uses the
   * native `output_config.format`; other providers degrade to prompt-for-JSON
   * but still populate `parsed`.
   */
  outputFormat?: StructuredOutputFormat;
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
  /**
   * Schema-validated object, present only when the request set `outputFormat`
   * (SYN-313). Null if the model response could not be parsed against the
   * schema. Callers should type-narrow via their own Zod schema.
   */
  parsed?: unknown;
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
