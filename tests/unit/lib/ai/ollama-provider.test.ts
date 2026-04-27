/**
 * Unit tests — SYN-807 Phase 1: Ollama provider.
 *
 * Mocks axios so the test suite does not require a running Ollama daemon.
 * Real round-trip verification is documented in the PR body.
 */

jest.mock('axios');
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from 'axios';
import {
  OllamaProvider,
  OllamaUnavailableError,
} from '@/lib/ai/providers/ollama-provider';
import type { AICompletionRequest } from '@/lib/ai/providers/base-provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Globally reset + re-implement `axios.isAxiosError` for every test. The
// reset happens here (not via local `beforeEach(() => jest.clearAllMocks())`
// in nested describes) so the implementation we set survives into the test.
// Without this, the auto-mocked isAxiosError returns undefined and the
// provider's error branching never engages (falls through to the bottom
// `throw error`).
beforeEach(() => {
  jest.clearAllMocks();
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockImplementation(
    (err: unknown) =>
      Boolean(
        err &&
        typeof err === 'object' &&
        ('isAxiosError' in err || 'config' in err)
      )
  );
});

const baseRequest: AICompletionRequest = {
  model: 'gemma4:e2b',
  messages: [{ role: 'user', content: 'Reply PONG' }],
};

describe('OllamaProvider — model presets', () => {
  it('exposes the documented preset map', () => {
    const p = new OllamaProvider();
    expect(p.name).toBe('Ollama');
    expect(p.models.fast).toBe('gemma4:e2b');
    expect(p.models.balanced).toBe('gemma4:e4b');
    expect(p.models.free).toBe('gemma4:e2b');
  });
});

describe('OllamaProvider.complete — happy path', () => {
  it('returns the assistant message in OpenAI-shaped envelope', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-26T00:00:00Z',
        message: { role: 'assistant', content: 'PONG' },
        done: true,
        prompt_eval_count: 7,
        eval_count: 3,
      },
    });

    const p = new OllamaProvider();
    const res = await p.complete(baseRequest);

    expect(res.choices).toHaveLength(1);
    expect(res.choices[0]?.message.content).toBe('PONG');
    expect(res.choices[0]?.message.role).toBe('assistant');
    expect(res.usage?.prompt_tokens).toBe(7);
    expect(res.usage?.completion_tokens).toBe(3);
    expect(res.usage?.total_tokens).toBe(10);
  });

  it('hard-disables Gemma 4 thinking unless caller asked for it', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-26T00:00:00Z',
        message: { role: 'assistant', content: 'ok' },
        done: true,
      },
    });

    const p = new OllamaProvider();
    await p.complete(baseRequest);

    const sentBody = mockedAxios.post.mock.calls[0]?.[1] as {
      think?: boolean;
    };
    expect(sentBody?.think).toBe(false);
  });

  it('forwards thinking flag when caller requested it', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-26T00:00:00Z',
        message: { role: 'assistant', content: 'ok' },
        done: true,
      },
    });

    const p = new OllamaProvider();
    await p.complete({ ...baseRequest, thinking: 'medium' });

    const sentBody = mockedAxios.post.mock.calls[0]?.[1] as {
      think?: boolean;
    };
    expect(sentBody?.think).toBe(true);
  });

  it('passes temperature, max_tokens, top_p as Ollama options', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-26T00:00:00Z',
        message: { role: 'assistant', content: 'ok' },
        done: true,
      },
    });

    const p = new OllamaProvider();
    await p.complete({
      ...baseRequest,
      temperature: 0.4,
      max_tokens: 256,
      top_p: 0.9,
    });

    const sentBody = mockedAxios.post.mock.calls[0]?.[1] as {
      options?: { temperature?: number; num_predict?: number; top_p?: number };
    };
    expect(sentBody?.options?.temperature).toBe(0.4);
    expect(sentBody?.options?.num_predict).toBe(256);
    expect(sentBody?.options?.top_p).toBe(0.9);
  });
});

describe('OllamaProvider.complete — error handling', () => {
  it('throws OllamaUnavailableError when daemon is not reachable (ECONNREFUSED)', async () => {
    const err = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:11434'),
      {
        isAxiosError: true,
        code: 'ECONNREFUSED',
        response: undefined,
      }
    );
    mockedAxios.post.mockRejectedValueOnce(err);

    const p = new OllamaProvider();
    await expect(p.complete(baseRequest)).rejects.toBeInstanceOf(
      OllamaUnavailableError
    );
  });

  it('throws plain Error when Ollama returns a 4xx/5xx', async () => {
    const err = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400, data: { error: 'model not found' } },
    });
    mockedAxios.post.mockRejectedValueOnce(err);

    const p = new OllamaProvider();
    await expect(p.complete(baseRequest)).rejects.toThrow('model not found');
  });
});

describe('OllamaProvider — env var customisation', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('honours OLLAMA_BASE_URL when configured', async () => {
    process.env.OLLAMA_BASE_URL = 'http://custom-host:8080/';
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-26T00:00:00Z',
        message: { role: 'assistant', content: 'ok' },
        done: true,
      },
    });

    const p = new OllamaProvider();
    await p.complete(baseRequest);

    const url = mockedAxios.post.mock.calls[0]?.[0] as string;
    // Trailing slash stripped, /api/chat appended.
    expect(url).toBe('http://custom-host:8080/api/chat');
  });
});
