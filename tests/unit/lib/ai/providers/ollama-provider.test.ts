/**
 * Ollama Provider — unit tests
 *
 * Verifies the Ollama provider's complete() flow, error mapping to
 * OllamaUnavailableError, and the prompt-building logic.
 */

import { OllamaProvider, OllamaUnavailableError } from '@/lib/ai/providers/ollama-provider';

describe('OllamaProvider', () => {
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('exposes the Gemma 4 preset model identifiers', () => {
    const p = new OllamaProvider('http://localhost:11434');
    expect(p.models.fast).toBe('gemma4:e2b');
    expect(p.models.balanced).toBe('gemma4:e4b');
    expect(p.models.free).toBe('gemma4:e2b');
    expect(p.name).toBe('Ollama');
  });

  it('complete() POSTs to /api/generate with think:false and returns AICompletionResponse', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'gemma4:e2b',
          created_at: '2026-04-27T00:00:00Z',
          response: 'PONG',
          done: true,
          prompt_eval_count: 4,
          eval_count: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const p = new OllamaProvider('http://localhost:11434');
    const res = await p.complete({
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'PING?' }],
      max_tokens: 10,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/generate');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('gemma4:e2b');
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body.options.num_predict).toBe(10);

    expect(res.choices[0].message.content).toBe('PONG');
    expect(res.choices[0].finish_reason).toBe('stop');
    expect(res.usage?.total_tokens).toBe(5);
  });

  it('complete() throws OllamaUnavailableError on ECONNREFUSED', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    global.fetch = jest.fn().mockRejectedValue(err) as unknown as typeof fetch;

    const p = new OllamaProvider('http://localhost:99999');
    await expect(
      p.complete({ model: 'gemma4:e2b', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it('complete() throws OllamaUnavailableError on fetch failed', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;
    const p = new OllamaProvider('http://localhost:11434');
    await expect(
      p.complete({ model: 'gemma4:e2b', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it('builds a tagged prompt that preserves system / user / assistant ordering', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: 'ok', done: true }), { status: 200 }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

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

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.prompt).toContain('[SYSTEM]\nsys-rule');
    expect(body.prompt).toContain('[USER]\nq1');
    expect(body.prompt).toContain('[ASSISTANT]\na1');
    expect(body.prompt).toContain('[USER]\nq2');
    expect(body.prompt.endsWith('[ASSISTANT]\n')).toBe(true);
  });
});
