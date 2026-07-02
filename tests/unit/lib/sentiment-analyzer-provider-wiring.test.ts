/**
 * Tests for the sentiment-analyzer provider wiring.
 *
 * Regression guard: analyzeWithAI used to call OpenRouter directly via a
 * hardcoded fetch gated on OPENROUTER_API_KEY. On the OpenAI-only deployment
 * that key is unset in prod, so AI sentiment silently degraded to the
 * keyword-based fallback — surfacing WRONG sentiment scores to users while the
 * rest of the platform generated real output via OpenAI. Companion to
 * #401 / #412 / #456 / #457.
 *
 * Proves:
 *  - AI sentiment is produced via the shared getAIProvider() factory (fast tier),
 *    NOT a raw OpenRouter fetch — even with no OPENROUTER_API_KEY set.
 *  - When the provider call rejects (e.g. no platform key configured), it
 *    degrades gracefully to the keyword-based fallback instead of throwing.
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

describe('analyzeSentiment — provider wiring', () => {
  it('analyses via getAIProvider() fast tier (not OpenRouter), even with no OPENROUTER_API_KEY', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '{"sentiment": "positive", "score": 0.9, "confidence": 0.95}',
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

    const { analyzeSentiment } = await import(
      '@/lib/social/sentiment-analyzer'
    );
    const result = await analyzeSentiment('This is absolutely wonderful!');

    // Platform-key path: factory called with no args, fast tier used.
    expect(getAIProvider).toHaveBeenCalledWith();
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    );
    // No raw OpenRouter (or any) fetch on the happy path.
    expect(fetchSpy).not.toHaveBeenCalled();
    // The AI result (high confidence) is surfaced, not the keyword fallback
    // (which caps confidence at 0.6).
    expect(result.sentiment).toBe('positive');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('falls back to keyword-based sentiment when the provider call fails', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const complete = jest
      .fn()
      .mockRejectedValue(new Error('OpenAI API key not configured'));
    const getAIProvider = jest.fn(() => ({
      name: 'OpenAI',
      models: { fast: 'gpt-4o-mini' },
      complete,
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { analyzeSentiment } = await import(
      '@/lib/social/sentiment-analyzer'
    );
    // Strongly positive keyword content so the fallback is deterministic.
    const result = await analyzeSentiment(
      'love great amazing awesome excellent fantastic'
    );

    expect(complete).toHaveBeenCalled();
    expect(result.sentiment).toBe('positive');
    // Keyword fallback caps confidence at 0.6.
    expect(result.confidence).toBeLessThanOrEqual(0.6);
  });
});
