/**
 * Unit tests — SYN-313: Anthropic structured outputs.
 *
 * Covers the shared helper (schema -> format), the fallback helpers, the
 * Anthropic native path surfacing `parsed`, and the non-Anthropic (OpenRouter)
 * prompt-for-JSON fallback still returning a `parsed` object.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// --- Anthropic SDK mock: capture the messages.parse / .create spies ---------
const mockParse = jest.fn();
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    apiKey: string;
    messages: { parse: jest.Mock; create: jest.Mock };
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
      this.messages = { parse: mockParse, create: mockCreate };
    }
    static APIError = class MockAPIError extends Error {};
  }
  return { __esModule: true, default: MockAnthropic };
});

jest.mock('axios');

import { z } from 'zod';
import axios from 'axios';
import {
  structuredOutput,
  withJsonInstruction,
  attachParsed,
} from '@/lib/ai/structured-output';
import { AnthropicProvider } from '@/lib/ai/providers/anthropic-provider';
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter-provider';
import type { AICompletionResponse } from '@/lib/ai/providers/base-provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: schema -> format
// ---------------------------------------------------------------------------

describe('structuredOutput', () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it('produces a json_schema format with a generated object schema', () => {
    const fmt = structuredOutput(schema);
    expect(fmt.type).toBe('json_schema');
    expect(fmt.schema).toMatchObject({ type: 'object' });
    expect((fmt.schema as { properties: unknown }).properties).toHaveProperty(
      'name'
    );
  });

  it('parse() returns the validated object for a valid payload', () => {
    const fmt = structuredOutput(schema);
    expect(fmt.parse('{"name":"Ada","age":36}')).toEqual({
      name: 'Ada',
      age: 36,
    });
  });

  it('parse() throws on a schema-violating payload', () => {
    const fmt = structuredOutput(schema);
    expect(() => fmt.parse('{"name":"Ada"}')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Fallback helpers (used by non-Anthropic providers)
// ---------------------------------------------------------------------------

describe('withJsonInstruction / attachParsed', () => {
  const fmt = structuredOutput(z.object({ a: z.string() }));

  it('appends a JSON-only instruction carrying the schema', () => {
    const out = withJsonInstruction([{ role: 'user', content: 'hi' }], fmt);
    expect(out).toHaveLength(2);
    expect(out[1].role).toBe('user');
    expect(out[1].content).toContain('JSON Schema');
    expect(out[1].content).toContain('"type":"object"');
  });

  const envelope = (content: string): AICompletionResponse => ({
    id: 'x',
    model: 'm',
    choices: [
      { message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
  });

  it('parses a plain JSON response into parsed', () => {
    const res = attachParsed(envelope('{"a":"hello"}'), fmt);
    expect(res.parsed).toEqual({ a: 'hello' });
  });

  it('strips markdown fences before parsing', () => {
    const res = attachParsed(envelope('```json\n{"a":"fenced"}\n```'), fmt);
    expect(res.parsed).toEqual({ a: 'fenced' });
  });

  it('degrades to null parsed on a malformed response', () => {
    const res = attachParsed(envelope('not json at all'), fmt);
    expect(res.parsed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Anthropic native path — surfaces parsed_output on `parsed`
// ---------------------------------------------------------------------------

describe('AnthropicProvider.complete — structured output', () => {
  const fmt = structuredOutput(z.object({ answer: z.number() }));

  it('uses messages.parse and returns the parsed object', async () => {
    mockParse.mockResolvedValueOnce({
      id: 'msg_1',
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: '{"answer":4}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 2 },
      parsed_output: { answer: 4 },
    });

    const provider = new AnthropicProvider('test-key');
    const res = await provider.complete({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      outputFormat: fmt,
    });

    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    const call = mockParse.mock.calls[0][0];
    expect(call.output_config.format).toBe(fmt);
    expect(res.parsed).toEqual({ answer: 4 });
    expect(res.choices[0].message.content).toBe('{"answer":4}');
  });

  it('falls back to messages.create (no parsed) when no outputFormat', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_2',
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: 'plain text' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 3, output_tokens: 1 },
    });

    const provider = new AnthropicProvider('test-key');
    const res = await provider.complete({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockParse).not.toHaveBeenCalled();
    expect(res.parsed).toBeUndefined();
    expect(res.choices[0].message.content).toBe('plain text');
  });
});

// ---------------------------------------------------------------------------
// Non-Anthropic fallback — OpenRouter still returns parsed
// ---------------------------------------------------------------------------

describe('OpenRouterProvider.complete — structured-output fallback', () => {
  const fmt = structuredOutput(z.object({ headline: z.string() }));

  it('injects a JSON instruction, strips outputFormat, and returns parsed', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'or_1',
        model: 'x/y',
        choices: [
          {
            message: { role: 'assistant', content: '{"headline":"Ship it"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
    });

    const provider = new OpenRouterProvider('test-key');
    const res = await provider.complete({
      model: 'x/y',
      messages: [{ role: 'user', content: 'Give me a headline' }],
      outputFormat: fmt,
    });

    expect(res.parsed).toEqual({ headline: 'Ship it' });

    const body = mockedAxios.post.mock.calls[0][1] as {
      messages: Array<{ content: string }>;
      outputFormat?: unknown;
    };
    // outputFormat must NOT be forwarded upstream (not an OpenRouter param)
    expect(body.outputFormat).toBeUndefined();
    // the JSON instruction is appended to the prompt
    expect(body.messages[body.messages.length - 1].content).toContain(
      'JSON Schema'
    );
  });

  it('degrades to null parsed when the model returns non-JSON', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'or_2',
        model: 'x/y',
        choices: [
          {
            message: { role: 'assistant', content: 'sorry, no JSON here' },
            finish_reason: 'stop',
          },
        ],
      },
    });

    const provider = new OpenRouterProvider('test-key');
    const res = await provider.complete({
      model: 'x/y',
      messages: [{ role: 'user', content: 'Give me a headline' }],
      outputFormat: fmt,
    });

    expect(res.parsed).toBeNull();
  });
});
