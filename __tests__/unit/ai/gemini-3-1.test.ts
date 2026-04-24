/**
 * Unit tests — Gemini 3.1 adoption (SYN-786)
 *
 * Coverage:
 *   1. Registry exposes gemini-3-1-flash and gemini-3-1-pro at tier 'latest'
 *   2. Gemini 2.5 Flash is retained at tier 'production' as fallback
 *   3. getLatestModel('google') resolves to a 3.1 model (most recent latest-tier entry)
 *   4. ModelPresets on GoogleProvider point at 3.1
 *   5. Native Function Calling: request.tools is forwarded in Gemini-native shape
 */

import { getLatestModel, getModel, getModels } from '@/lib/ai/model-registry';
import { GoogleProvider } from '@/lib/ai/providers/google-provider';

describe('SYN-786 — Gemini 3.1 registry', () => {
  it('exposes gemini-3-1-flash at tier latest', () => {
    const model = getModel('google', 'gemini-3-1-flash');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('google');
    expect(model?.tier).toBe('latest');
    expect(model?.supportsTools).toBe(true);
    expect(model?.supportsStreaming).toBe(true);
  });

  it('exposes gemini-3-1-pro at tier latest with 2M context', () => {
    const model = getModel('google', 'gemini-3-1-pro');
    expect(model).toBeDefined();
    expect(model?.tier).toBe('latest');
    expect(model?.contextWindow).toBeGreaterThanOrEqual(2_000_000);
  });

  it('retains gemini-2-5-flash as production tier fallback', () => {
    const model = getModel('google', 'gemini-2-5-flash');
    expect(model).toBeDefined();
    expect(model?.tier).toBe('production');
    expect(model?.isDeprecated).toBe(false);
  });

  it('getLatestModel(google) resolves to a 3.1 entry', () => {
    const latest = getLatestModel('google');
    expect(latest.id).toMatch(/^gemini-3-1-/);
  });

  it('mirrors 3.1 entries on the openrouter block', () => {
    const openrouter = getModels('openrouter');
    expect(openrouter.some(m => m.id === 'google/gemini-3.1-flash')).toBe(true);
    expect(openrouter.some(m => m.id === 'google/gemini-3.1-pro')).toBe(true);
  });
});

describe('SYN-786 — GoogleProvider presets', () => {
  it('points fast at Gemini 3.1 Flash', () => {
    const provider = new GoogleProvider('dummy-key');
    expect(provider.models.fast).toBe('gemini-3.1-flash');
  });

  it('points balanced/premium at Gemini 3.1 Pro', () => {
    const provider = new GoogleProvider('dummy-key');
    expect(provider.models.balanced).toBe('gemini-3.1-pro');
    expect(provider.models.premium).toBe('gemini-3.1-pro');
  });
});

describe('SYN-786 — Native Function Calling wire-up', () => {
  const originalFetch = global.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  function mockFetch(responsePayload: object) {
    global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
      const requestInit = init as { body: string };
      capturedBody = JSON.parse(requestInit.body);
      return {
        ok: true,
        status: 200,
        json: async () => responsePayload,
      } as unknown as Response;
    }) as typeof fetch;
  }

  beforeEach(() => {
    capturedBody = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const okResponse = {
    candidates: [
      {
        content: { parts: [{ text: 'ok' }] },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 1,
      candidatesTokenCount: 1,
      totalTokenCount: 2,
    },
  };

  it('forwards tools in Gemini-native [{ functionDeclarations: [...] }] shape', async () => {
    mockFetch(okResponse);
    const provider = new GoogleProvider('test-key');
    await provider.complete({
      model: 'gemini-3.1-flash',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        {
          name: 'get_weather',
          description: 'Fetch the weather for a city',
          input_schema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
      ],
    });

    const body = capturedBody as {
      tools?: Array<{ functionDeclarations: Array<{ name: string }> }>;
    };
    expect(body.tools).toBeDefined();
    expect(body.tools?.[0].functionDeclarations).toHaveLength(1);
    expect(body.tools?.[0].functionDeclarations[0].name).toBe('get_weather');
  });

  it('omits tools field when request has no tools', async () => {
    mockFetch(okResponse);
    const provider = new GoogleProvider('test-key');
    await provider.complete({
      model: 'gemini-3.1-flash',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(capturedBody).not.toBeNull();
    expect((capturedBody as Record<string, unknown>).tools).toBeUndefined();
  });
});
