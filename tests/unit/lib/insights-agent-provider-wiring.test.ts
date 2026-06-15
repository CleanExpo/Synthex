/**
 * Tests for the insights-agent provider wiring.
 *
 * Regression guard: generateOpportunities and generateDrafts used to call
 * OpenRouter directly via hardcoded fetches gated on OPENROUTER_API_KEY. On the
 * OpenAI-only deployment that key is unset in prod, so the agent silently
 * degraded — generateOpportunities returned a single canned sample and
 * generateDrafts returned nothing — producing empty/no real insights.
 * Companion to #401 / #412 / #456 / #457.
 *
 * Proves:
 *  - Opportunity + draft generation run via the shared getAIProvider() factory
 *    (fast tier), NOT a raw OpenRouter fetch — even with no OPENROUTER_API_KEY.
 *  - When the provider call rejects, generation degrades gracefully to an empty
 *    result rather than throwing.
 *
 * Mocks are registered per-test with jest.doMock (the suite runs under
 * resetMocks/restoreMocks, which would otherwise wipe a hoisted factory's
 * implementation before each test).
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

/** Minimal Prisma mock — drives runInsightsAgent past the circuit breaker and
 * data-gathering so the AI generation path executes. */
function mockPrisma() {
  jest.doMock('@/lib/prisma', () => ({
    prisma: {
      workflowExecution: {
        findFirst: jest.fn().mockResolvedValue(null), // no recent run
        count: jest.fn().mockResolvedValue(0), // under daily cap
        create: jest.fn().mockResolvedValue({ id: 'exec-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      platformConnection: { findMany: jest.fn().mockResolvedValue([]) },
      socialMention: { findMany: jest.fn().mockResolvedValue([]) },
      post: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
      platformMetrics: { findMany: jest.fn().mockResolvedValue([]) },
      campaign: { create: jest.fn().mockResolvedValue({ id: 'camp-1' }) },
      stepExecution: { create: jest.fn().mockResolvedValue({}) },
    },
  }));
}

describe('runInsightsAgent — provider wiring', () => {
  it('generates via getAIProvider() fast tier (not OpenRouter), even with no OPENROUTER_API_KEY', async () => {
    delete process.env.OPENROUTER_API_KEY;
    mockPrisma();

    const complete = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              opportunities: [
                {
                  title: 'Video opportunity',
                  description: 'Short-form video would perform well.',
                  confidenceScore: 0.5,
                  suggestedPlatforms: ['instagram'],
                  urgency: 'medium',
                },
              ],
            }),
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

    const { runInsightsAgent } = await import('@/lib/agents/insights-agent');
    const result = await runInsightsAgent('org-1');

    expect(getAIProvider).toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    );
    // No raw OpenRouter (or any) fetch anywhere in the run.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.circuitBreakerTripped).toBe(false);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toBe('Video opportunity');
    expect(result.generatedDrafts.length).toBeGreaterThan(0);
  });

  it('degrades to empty insights (no throw) when the provider call fails', async () => {
    delete process.env.OPENROUTER_API_KEY;
    mockPrisma();

    const complete = jest
      .fn()
      .mockRejectedValue(new Error('OpenAI API key not configured'));
    const getAIProvider = jest.fn(() => ({
      name: 'OpenAI',
      models: { fast: 'gpt-4o-mini' },
      complete,
    }));
    jest.doMock('@/lib/ai/providers', () => ({ getAIProvider }));

    const { runInsightsAgent } = await import('@/lib/agents/insights-agent');
    const result = await runInsightsAgent('org-1');

    expect(complete).toHaveBeenCalled();
    expect(result.opportunities).toEqual([]);
    expect(result.generatedDrafts).toEqual([]);
    expect(result.autoDraftedCount).toBe(0);
    expect(result.queuedForReviewCount).toBe(0);
  });
});
