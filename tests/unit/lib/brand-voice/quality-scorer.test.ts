/**
 * Tests for QualityScorer provider wiring.
 *
 * Regression guard: the scorer used to hard-require OPENROUTER_API_KEY in its
 * constructor and call OpenRouter directly. On the OpenAI-only deployment that
 * threw "OPENROUTER_API_KEY is not configured", surfacing as a 500 on
 * POST /api/brand-voice/score and silently disabling scoring in the
 * human-approval workflow step.
 *
 * Proves:
 *  - The constructor never throws (no provider key required at construction).
 *  - scoreContent() scores via the shared getAIProvider() factory and parses
 *    the provider's JSON into a QualityScore (incl. weighted overall +
 *    autoApprove flag).
 *  - When the provider call fails (e.g. no platform key configured), scoreContent
 *    degrades to the conservative manual-review fallback instead of throwing.
 *  - A user-supplied key is forwarded to the factory's user-key path.
 */

// quality-scorer imports the logger; keep it quiet and side-effect-free.
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('QualityScorer — provider wiring', () => {
  it('constructs without any provider key (no throw)', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { QualityScorer } = await import('@/lib/brand-voice/quality-scorer');
    expect(() => new QualityScorer()).not.toThrow();
  });

  it('scores via getAIProvider() and parses the JSON into a QualityScore', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              brandAlignment: 0.9,
              clarity: 0.9,
              engagement: 0.8,
              appropriateness: 0.9,
              flags: [],
              reasoning: 'On-brand and clear.',
            }),
          },
        },
      ],
    });
    const getAIProvider = jest.fn(() => ({
      models: { fast: 'gpt-4o-mini' },
      complete,
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { QualityScorer } = await import('@/lib/brand-voice/quality-scorer');
    const scorer = new QualityScorer();
    const score = await scorer.scoreContent('Some on-brand content.');

    // Platform-key path: factory called with no args.
    expect(getAIProvider).toHaveBeenCalledWith();
    // Used the fast (cheap) tier at low temperature.
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini', temperature: 0.2 })
    );
    // Weighted overall: .9*.3 + .9*.3 + .8*.25 + .9*.15 = 0.875 → auto-approve.
    expect(score.overall).toBeCloseTo(0.88, 2);
    expect(score.autoApprove).toBe(true);
    expect(score.dimensions.brandAlignment).toBe(0.9);
    expect(score.flags).toEqual([]);
  });

  it('returns the conservative fallback (no throw) when the provider call fails', async () => {
    const getAIProvider = jest.fn(() => ({
      models: { fast: 'gpt-4o-mini' },
      complete: jest
        .fn()
        .mockRejectedValue(new Error('OpenAI API key not configured')),
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { QualityScorer } = await import('@/lib/brand-voice/quality-scorer');
    const scorer = new QualityScorer();
    const score = await scorer.scoreContent('content');

    expect(score.autoApprove).toBe(false);
    expect(score.overall).toBe(0);
    expect(score.dimensions).toEqual({
      brandAlignment: 0,
      clarity: 0,
      engagement: 0,
      appropriateness: 0,
    });
    expect(score.flags).toEqual([
      'Scoring service unavailable — manual review recommended',
    ]);
  });

  it('forwards a user-supplied key to the factory user-key path', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{"brandAlignment":0.5}' } }],
    });
    const getAIProvider = jest.fn(() => ({
      models: { fast: 'gpt-4o-mini' },
      complete,
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { QualityScorer } = await import('@/lib/brand-voice/quality-scorer');
    const scorer = new QualityScorer('user-key-123');
    await scorer.scoreContent('content');

    expect(getAIProvider).toHaveBeenCalledWith({ apiKey: 'user-key-123' });
  });
});
