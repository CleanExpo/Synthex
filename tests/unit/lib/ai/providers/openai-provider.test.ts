/**
 * OpenAI Provider — unit tests
 *
 * Verifies the OpenAI provider builds the chat-completion request correctly
 * and maps the SDK response back to the shared AICompletionResponse shape.
 *
 * The `openai` SDK is fully mocked — NO real network calls are made.
 */

// --- Mock the openai SDK before importing the provider ---
const mockCreate = jest.fn();

class MockAPIError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

jest.mock('openai', () => {
  class OpenAI {
    apiKey?: string;
    chat = { completions: { create: mockCreate } };
    constructor(opts: { apiKey?: string }) {
      this.apiKey = opts?.apiKey;
    }
  }
  return {
    __esModule: true,
    default: OpenAI,
    APIError: MockAPIError,
  };
});

import { OpenAIProvider } from '@/lib/ai/providers/openai-provider';

describe('OpenAIProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'sk-test-key' };
    // Clear any model preset overrides so defaults are asserted.
    delete process.env.OPENAI_MODEL_FAST;
    delete process.env.OPENAI_MODEL_BALANCED;
    delete process.env.OPENAI_MODEL_CREATIVE;
    delete process.env.OPENAI_MODEL_PREMIUM;
    delete process.env.OPENAI_MODEL_CODE;
    delete process.env.OPENAI_MODEL_FREE;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('exposes sensible default OpenAI model presets', () => {
    const p = new OpenAIProvider();
    expect(p.name).toBe('OpenAI');
    expect(p.models.fast).toBe('gpt-4o-mini');
    expect(p.models.balanced).toBe('gpt-4o-mini');
    expect(p.models.creative).toBe('gpt-4o');
    expect(p.models.premium).toBe('gpt-4o');
  });

  it('honours OPENAI_MODEL_* env overrides for presets', () => {
    process.env.OPENAI_MODEL_BALANCED = 'gpt-4.1';
    process.env.OPENAI_MODEL_CREATIVE = 'gpt-4.1';
    const p = new OpenAIProvider();
    expect(p.models.balanced).toBe('gpt-4.1');
    expect(p.models.creative).toBe('gpt-4.1');
  });

  it('complete() builds an OpenAI chat request and maps the response', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-123',
      model: 'gpt-4o-mini',
      choices: [
        {
          message: { role: 'assistant', content: 'Hello from OpenAI' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const p = new OpenAIProvider();
    const res = await p.complete({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ],
      temperature: 0.8,
      max_tokens: 256,
    });

    // Request was built correctly and passed to the SDK.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.model).toBe('gpt-4o-mini');
    expect(arg.temperature).toBe(0.8);
    expect(arg.max_tokens).toBe(256);
    expect(arg.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]);
    // Streaming must not be enabled on the non-stream path.
    expect(arg.stream).toBeUndefined();

    // Response is mapped into the unified shape.
    expect(res.id).toBe('chatcmpl-123');
    expect(res.choices[0].message.content).toBe('Hello from OpenAI');
    expect(res.choices[0].finish_reason).toBe('stop');
    expect(res.usage?.total_tokens).toBe(15);
  });

  it('complete() throws a clean error when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    const p = new OpenAIProvider();
    await expect(
      p.complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow('OpenAI API key not configured');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('complete() surfaces the OpenAI APIError message', async () => {
    mockCreate.mockRejectedValueOnce(new MockAPIError('rate limited', 429));
    const p = new OpenAIProvider();
    await expect(
      p.complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow('rate limited');
  });
});
