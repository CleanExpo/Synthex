/**
 * Tests for generateInstantPostPreview provider wiring.
 *
 * Regression guard: the brand-voice instant-preview path (the wizard's
 * "Analyse my brand with AI" first-post preview, invoked by
 * POST /api/brand-dna/extract) used to call OpenRouter directly via a hardcoded
 * fetch gated on OPENROUTER_API_KEY. On the OpenAI-only deployment that key is
 * unset in prod, so the preview silently returned a canned fallback template
 * while the rest of the same brand-DNA extraction (website-analyzer,
 * onboarding-pipeline) generated real copy via OpenAI. Companion to #401 / #412.
 *
 * Proves:
 *  - The preview generates via the shared getAIProvider() factory (fast tier),
 *    NOT a raw OpenRouter fetch.
 *  - When the provider call fails (e.g. no platform key configured), it degrades
 *    to a non-empty fallback template instead of throwing.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('generateInstantPostPreview — provider wiring', () => {
  it('generates via getAIProvider() fast tier (not OpenRouter), even with no OPENROUTER_API_KEY', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Jake's Café pours Melbourne's best flat white. Pop in this morning.",
          },
        },
      ],
    });
    const getAIProvider = jest.fn(() => ({
      name: 'OpenAI',
      models: { fast: 'gpt-4o-mini' },
      complete,
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('fetch should not be called'));

    const { generateInstantPostPreview } = await import(
      '@/lib/brand-dna/post-preview'
    );
    const result = await generateInstantPostPreview({
      businessName: "Jake's Café",
      industry: 'café',
      heroCopy: 'Best coffee in Melbourne',
    });

    // Platform-key path: factory called with no args, fast tier used.
    expect(getAIProvider).toHaveBeenCalledWith();
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    );
    // No raw OpenRouter (or any) fetch on the happy path.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toContain('Melbourne');
  });

  it('falls back to a non-empty template when the provider call fails', async () => {
    const getAIProvider = jest.fn(() => ({
      name: 'OpenAI',
      models: { fast: 'gpt-4o-mini' },
      complete: jest
        .fn()
        .mockRejectedValue(new Error('OpenAI API key not configured')),
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { generateInstantPostPreview } = await import(
      '@/lib/brand-dna/post-preview'
    );
    const result = await generateInstantPostPreview({
      businessName: 'Test Biz',
      industry: 'retail',
      heroCopy: '',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain('Test Biz');
  });
});
