/**
 * Provider-wiring regression guards (mirrors the #456 post-preview guard).
 *
 * These four lib AI-generation paths previously did a raw `fetch` to OpenRouter
 * gated on OPENROUTER_API_KEY, which silently degraded to canned/template
 * content (or threw) on this OpenAI-only deployment where OPENROUTER_API_KEY is
 * unset. They now route through the shared provider factory `getAIProvider()`.
 *
 * Each suite proves:
 *  1. Generation goes via getAIProvider().complete with NO raw OpenRouter fetch,
 *     even when OPENROUTER_API_KEY is unset.
 *  2. The existing graceful fallback (or throw contract) is preserved when the
 *     provider rejects.
 */

// Cost tracking hits the DB — stub it so these stay pure unit tests.
jest.mock('@/lib/pipelines/track-cost', () => ({
  calculatePipelineCost: jest.fn().mockReturnValue(0),
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
}));

const ORIGINAL_ENV = { ...process.env };

/** Spy on global fetch; fail loudly if anything calls OpenRouter. */
let fetchSpy: jest.SpyInstance;

function installFetchGuard() {
  fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      throw new Error(`Unexpected network fetch in test: ${url}`);
    });
}

function assertNoOpenRouterFetch() {
  const calledOpenRouter = fetchSpy.mock.calls.some(([input]) => {
    const url = typeof input === 'string' ? input : String(input);
    return url.includes('openrouter.ai');
  });
  expect(calledOpenRouter).toBe(false);
}

beforeEach(() => {
  jest.resetModules();
  // The deployment condition under test: OpenAI-only, OPENROUTER_API_KEY unset.
  delete process.env.OPENROUTER_API_KEY;
  installFetchGuard();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
  jest.resetModules();
});

// ── lib/calendar/captionGenerator.ts ────────────────────────────────────────
describe('captionGenerator.generateCaptions — provider wiring', () => {
  it('generates via getAIProvider (no OpenRouter fetch) when OPENROUTER_API_KEY is unset', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(['cap one', 'cap two', 'cap three']),
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({ name: 'OpenAI', models: { fast: 'gpt-4o-mini' }, complete }),
    }));

    const { generateCaptions } = await import('@/lib/calendar/captionGenerator');
    const out = await generateCaptions(
      {
        platform: 'instagram',
        contentType: 'educational',
        businessName: 'Acme',
        industry: 'retail',
        tone: 'warm',
        hashtags: [],
      },
      'org-1'
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(out).toEqual(['cap one', 'cap two', 'cap three']);
    assertNoOpenRouterFetch();
  });

  it('falls back to canned captions when the provider rejects', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        name: 'OpenAI',
        models: { fast: 'gpt-4o-mini' },
        complete: jest.fn().mockRejectedValue(new Error('upstream 500')),
      }),
    }));

    const { generateCaptions } = await import('@/lib/calendar/captionGenerator');
    const out = await generateCaptions(
      {
        platform: 'instagram',
        contentType: 'educational',
        businessName: 'Acme',
        industry: 'retail',
        tone: 'warm',
        hashtags: [],
      },
      'org-1'
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(3);
    assertNoOpenRouterFetch();
  });
});

// ── lib/brandiq/generateNextSteps.ts ────────────────────────────────────────
describe('generateNextSteps — provider wiring', () => {
  it('generates via getAIProvider (no OpenRouter fetch) when OPENROUTER_API_KEY is unset', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { action: 'Do A', reason: 'Because A' },
              { action: 'Do B', reason: 'Because B' },
              { action: 'Do C', reason: 'Because C' },
            ]),
          },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 10 },
    });
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({ name: 'OpenAI', models: { fast: 'gpt-4o-mini' }, complete }),
    }));

    const { generateNextSteps } = await import('@/lib/brandiq/generateNextSteps');
    const out = await generateNextSteps(
      { businessName: 'Acme', industry: 'retail', vertical: 'b2c', tone: 'warm' },
      'org-1'
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(out[0].action).toBe('Do A');
    assertNoOpenRouterFetch();
  });

  it('falls back to generic next steps when the provider rejects', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        name: 'OpenAI',
        models: { fast: 'gpt-4o-mini' },
        complete: jest.fn().mockRejectedValue(new Error('upstream 500')),
      }),
    }));

    const { generateNextSteps } = await import('@/lib/brandiq/generateNextSteps');
    const out = await generateNextSteps(
      { businessName: 'Acme', industry: 'retail', vertical: 'b2c', tone: 'warm' },
      'org-1'
    );

    expect(out).toHaveLength(3);
    expect(typeof out[0].action).toBe('string');
    assertNoOpenRouterFetch();
  });
});

// ── lib/content-intelligence/topic-extractor.ts ─────────────────────────────
describe('topic-extractor.classifyPosts — provider wiring', () => {
  const posts = [
    {
      id: 'p1',
      content: 'hello world',
      hashtags: ['#x'],
      engagementRate: 0.1,
      format: 'image' as const,
      publishedAt: '2026-01-02T09:00:00.000Z',
    },
  ];

  it('classifies via getAIProvider (no OpenRouter fetch) when OPENROUTER_API_KEY is unset', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                postId: 'p1',
                topics: ['tip'],
                format: 'image',
                dayOfWeek: 'FRI',
                hourUtc: 9,
                engagementRate: 0.1,
                hashtags: ['#x'],
              },
            ]),
          },
        },
      ],
    });
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({ name: 'OpenAI', models: { fast: 'gpt-4o-mini' }, complete }),
    }));

    const { classifyPosts } = await import('@/lib/content-intelligence/topic-extractor');
    const out = await classifyPosts(posts);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(out[0].topics).toEqual(['tip']);
    assertNoOpenRouterFetch();
  });

  it('falls back to deterministic classifications when the provider rejects', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        name: 'OpenAI',
        models: { fast: 'gpt-4o-mini' },
        complete: jest.fn().mockRejectedValue(new Error('upstream 500')),
      }),
    }));

    const { classifyPosts } = await import('@/lib/content-intelligence/topic-extractor');
    const out = await classifyPosts(posts);

    expect(out).toHaveLength(1);
    expect(out[0].postId).toBe('p1');
    expect(out[0].topics).toEqual(['general']);
    assertNoOpenRouterFetch();
  });
});

// ── lib/ai-writing-assistant.ts ─────────────────────────────────────────────
describe('ai-writing-assistant.generateContent — provider wiring', () => {
  it('generates via getAIProvider (no OpenRouter fetch) when OPENROUTER_API_KEY is unset', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Generated post copy.' } }],
    });
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({ name: 'OpenAI', models: { fast: 'gpt-4o-mini' }, complete }),
    }));

    const { generateContent } = await import('@/lib/ai-writing-assistant');
    const out = await generateContent({
      prompt: 'coffee shop launch',
      style: { tone: 'friendly', length: 'short' },
    });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(out.content).toBe('Generated post copy.');
    assertNoOpenRouterFetch();
  });

  it('propagates provider failure (throws, contract unchanged) with no OpenRouter fetch', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        name: 'OpenAI',
        models: { fast: 'gpt-4o-mini' },
        complete: jest.fn().mockRejectedValue(new Error('upstream 500')),
      }),
    }));

    const { generateContent } = await import('@/lib/ai-writing-assistant');
    await expect(
      generateContent({
        prompt: 'coffee shop launch',
        style: { tone: 'friendly', length: 'short' },
      })
    ).rejects.toThrow('upstream 500');
    assertNoOpenRouterFetch();
  });
});
