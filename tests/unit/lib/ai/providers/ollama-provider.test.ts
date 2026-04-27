/**
 * Ollama Provider — unit tests
 *
 * Verifies the Ollama provider's complete() flow, error mapping to
 * OllamaUnavailableError, and the prompt-building logic.
 *
 * Mocks axios because the provider uses `axios.post` (not `fetch`) and
 * targets the native `/api/chat` endpoint (not `/api/generate`).
 */

import axios from 'axios';
import {
  OllamaProvider,
  OllamaUnavailableError,
} from '@/lib/ai/providers/ollama-provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // axios.isAxiosError is consulted in the provider's error handler.
    (mockedAxios as unknown as { isAxiosError: jest.Mock }).isAxiosError =
      jest.fn().mockImplementation((err: unknown) => {
        return Boolean(
          err && typeof err === 'object' && 'isAxiosError' in (err as object)
        );
      });
  });

  it('exposes the Gemma 4 preset model identifiers', () => {
    const p = new OllamaProvider();
    expect(p.models.fast).toBe('gemma4:e2b');
    expect(p.models.balanced).toBe('gemma4:e4b');
    expect(p.models.free).toBe('gemma4:e2b');
    expect(p.name).toBe('Ollama');
  });

  it('complete() POSTs to /api/chat with think:false and returns AICompletionResponse', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e2b',
        created_at: '2026-04-27T00:00:00Z',
        message: { role: 'assistant', content: 'PONG' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 4,
        eval_count: 1,
      },
    });

    const p = new OllamaProvider();
    const res = await p.complete({
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'PING?' }],
      max_tokens: 10,
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxios.post.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect((body as { model: string }).model).toBe('gemma4:e2b');
    expect((body as { stream: boolean }).stream).toBe(false);
    expect((body as { think: boolean }).think).toBe(false);
    expect(
      (body as { options: { num_predict: number } }).options.num_predict
    ).toBe(10);

    expect(res.choices[0].message.content).toBe('PONG');
    expect(res.choices[0].finish_reason).toBe('stop');
    expect(res.usage?.total_tokens).toBe(5);
  });

  it('complete() throws OllamaUnavailableError on ECONNREFUSED', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
      isAxiosError: true,
    });
    mockedAxios.post.mockRejectedValueOnce(err);

    const p = new OllamaProvider();
    await expect(
      p.complete({
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it('complete() throws OllamaUnavailableError when axios reports no response (network failure)', async () => {
    const err = Object.assign(new Error('connect ENOTFOUND'), {
      code: 'ENOTFOUND',
      isAxiosError: true,
    });
    mockedAxios.post.mockRejectedValueOnce(err);

    const p = new OllamaProvider();
    await expect(
      p.complete({
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it('builds a request that preserves system / user / assistant ordering', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'gemma4:e4b',
        created_at: '2026-04-27T00:00:00Z',
        message: { role: 'assistant', content: 'ok' },
        done: true,
      },
    });

    const p = new OllamaProvider();
    await p.complete({
      model: 'gemma4:e4b',
      messages: [
        { role: 'system', content: 'sys-rule' },
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'q2' },
      ],
    });

    const body = mockedAxios.post.mock.calls[0][1] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys-rule' },
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
  });
});
