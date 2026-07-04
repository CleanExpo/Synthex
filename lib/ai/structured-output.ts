/**
 * Structured Output helper (SYN-313)
 *
 * Turns a Zod schema into a provider-agnostic {@link StructuredOutputFormat}
 * that AI providers can enforce natively (Anthropic `output_config.format`) or
 * validate against a prompt-for-JSON fallback (every other provider).
 *
 * Built on the Anthropic SDK's `zodOutputFormat()` (helpers/zod), which — in
 * @anthropic-ai/sdk 0.92.0 — is compiled against `zod/v4` and generates the
 * JSON Schema via `z.toJSONSchema()`. That matches this repo's installed
 * zod v4, so no separate schema-generation path is needed.
 *
 * DESCOPE NOTE (SYN-313): the ticket also named Revenue attribution and Stripe
 * webhooks as structured-output candidates. Both are intentionally OUT OF
 * SCOPE here — Revenue attribution is deterministic (no LLM in the loop) and
 * Stripe webhooks are already Stripe-SDK-typed and internal-only. Structured
 * outputs only earn their keep where an LLM emits free-form JSON we must parse.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodType, infer as ZodInfer } from 'zod';
import type {
  AIMessage,
  AICompletionResponse,
  StructuredOutputFormat,
} from './providers/base-provider';

/**
 * Wrap a Zod schema in a {@link StructuredOutputFormat}.
 *
 * The returned `parse()` validates the raw JSON string against the schema and
 * throws on mismatch (so callers can catch + fall back rather than ship a
 * malformed object).
 *
 * @example
 *   const Brief = z.object({ goal: z.string() });
 *   const fmt = structuredOutput(Brief);
 *   const res = await ai.complete({ ...req, outputFormat: fmt });
 *   const brief = res.parsed as z.infer<typeof Brief>;
 */
export function structuredOutput<Schema extends ZodType>(
  schema: Schema
): StructuredOutputFormat<ZodInfer<Schema>> {
  const format = zodOutputFormat(schema);
  return {
    type: 'json_schema',
    schema: format.schema as Record<string, unknown>,
    parse: (content: string): ZodInfer<Schema> =>
      format.parse(content) as ZodInfer<Schema>,
  };
}

// ---------------------------------------------------------------------------
// Non-Anthropic fallback (SYN-313)
//
// Providers without native structured outputs (OpenRouter, OpenAI, …) can't
// enforce `output_config.format`. Instead they append a JSON-only instruction
// to the prompt, then validate the free-form response against the same schema.
// This keeps the shared `complete()` contract intact — the caller always gets
// a `parsed` field, whichever provider answered.
// ---------------------------------------------------------------------------

/**
 * Append a JSON-only instruction carrying the schema, so a non-native provider
 * emits a response we can parse. Returns a new message array (non-mutating).
 */
export function withJsonInstruction(
  messages: AIMessage[],
  format: StructuredOutputFormat
): AIMessage[] {
  const instruction =
    'Respond with ONLY a single JSON object that conforms to this JSON Schema. ' +
    'Do not wrap it in markdown fences and do not add any prose.\n\n' +
    JSON.stringify(format.schema);
  return [...messages, { role: 'user', content: instruction }];
}

/**
 * Extract JSON from a completed response, validate it against the schema, and
 * return a copy with `parsed` populated (null on any parse/validation failure,
 * so a malformed model reply degrades gracefully rather than throwing).
 */
export function attachParsed(
  response: AICompletionResponse,
  format: StructuredOutputFormat
): AICompletionResponse {
  const raw = response.choices[0]?.message?.content ?? '';
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();
  let parsed: unknown = null;
  try {
    parsed = format.parse(cleaned);
  } catch {
    parsed = null;
  }
  return { ...response, parsed };
}
