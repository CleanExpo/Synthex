/**
 * Provider-wiring regression test for ClientBrandedContentService.
 *
 * Synthex is OpenAI-only in production: getAIProvider() defaults to OpenAI and
 * OPENROUTER_API_KEY is UNSET. The Synthex platform-fallback generation path
 * (used when an org has no client Vault key) previously hard-fetched OpenRouter
 * and threw "No AI credentials available" when OPENROUTER_API_KEY was missing —
 * silently degrading the main branded content path on this deployment
 * (recurring defect #401/#412/#456/#457).
 *
 * This suite proves:
 *  - With NO client Vault key and NO OPENROUTER_API_KEY (only OPENAI_API_KEY),
 *    generation goes through getAIProvider() — NOT a raw OpenRouter fetch.
 *  - The result still carries the brand + a real (non-template) body.
 *  - When the provider rejects, the service throws (so the route's existing
 *    graceful fallback to aiContentGenerator still fires) — it does NOT
 *    silently return canned content.
 *  - The client-Vault (BYOK) path is untouched: a Vault key still drives a
 *    direct OpenRouter fetch.
 */

const ORIGINAL_ENV = { ...process.env };

// Mock the AI provider factory so we can assert the platform path uses it.
// The complete() mock is created inside the factory (jest.mock is hoisted, so
// referencing an outer const here would hit the temporal-dead-zone) and then
// pulled out via the mocked module below.
jest.mock('@/lib/ai/providers', () => {
  const complete = jest.fn();
  const getAIProvider = jest.fn();
  // jest.fn().mockReturnValue(...) does not stick under this ts-jest setup, so
  // give the mock a real implementation inline.
  getAIProvider.mockImplementation(() => ({
    name: 'OpenAI',
    models: { fast: 'gpt-4o-mini', balanced: 'gpt-4o-mini' },
    complete,
  }));
  return {
    __esModule: true,
    __completeMock: complete,
    getAIProvider,
  };
});

// Mock the Vault so we control whether the org has a client (BYOK) key.
const getSecretMock = jest.fn();
jest.mock('@/lib/vault/vault-service', () => ({
  VaultService: {
    getSecret: (...args: unknown[]) => getSecretMock(...args),
    getSecretMetadata: jest.fn(),
  },
}));

// Mock prisma so brand-profile load doesn't hit a DB.
jest.mock('@/lib/prisma', () => ({
  prisma: {
    brandDNA: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

import { ClientBrandedContentService } from '@/lib/services/client-branded-content';
import { getAIProvider } from '@/lib/ai/providers';

// Pull the complete() mock out of the mocked module (created in jest.mock above).
const completeMock = (
  jest.requireMock('@/lib/ai/providers') as { __completeMock: jest.Mock }
).__completeMock;

const baseRequest = {
  orgId: 'org-1',
  userId: 'user-1',
  platform: 'linkedin',
  prompt: 'Announce our new water-damage response service',
  contentType: 'post' as const,
};

beforeEach(() => {
  // Re-establish the provider impl in case a prior test reset it.
  (getAIProvider as jest.Mock).mockImplementation(() => ({
    name: 'OpenAI',
    models: { fast: 'gpt-4o-mini', balanced: 'gpt-4o-mini' },
    complete: completeMock,
  }));
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.clearAllMocks();
});

describe('ClientBrandedContentService — platform fallback (OpenAI-only)', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-openai';
    getSecretMock.mockResolvedValue(null); // no client Vault key → platform path
  });

  it('routes generation through getAIProvider() with NO raw OpenRouter fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    } as unknown as Response);
    completeMock.mockResolvedValue({
      id: 'cmpl-1',
      model: 'gpt-4o-mini',
      choices: [{ message: { role: 'assistant', content: 'Real AI copy.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const result = await ClientBrandedContentService.generate(baseRequest);

    // The provider factory was used...
    expect(getAIProvider).toHaveBeenCalled();
    expect(completeMock).toHaveBeenCalledTimes(1);
    // ...and NO raw fetch to OpenRouter happened on the platform path.
    const openRouterCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('openrouter.ai')
    );
    expect(openRouterCalls).toHaveLength(0);

    // Real content, not a canned template, with the provider's model.
    expect(result.content).toBe('Real AI copy.');
    expect(result.credentialSource).toBe('synthex_fallback');
    expect(result.model).toBe('gpt-4o-mini');

    fetchSpy.mockRestore();
  });

  it('throws (not silently degrades) when the provider rejects, so the route fallback fires', async () => {
    completeMock.mockRejectedValue(new Error('upstream 500'));
    await expect(ClientBrandedContentService.generate(baseRequest)).rejects.toThrow();
  });

  it('still throws the actionable error when no platform key is configured at all', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    await expect(ClientBrandedContentService.generate(baseRequest)).rejects.toThrow(
      /No AI credentials available/
    );
    expect(completeMock).not.toHaveBeenCalled();
  });
});

describe('ClientBrandedContentService — client Vault (BYOK) path unchanged', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-openai';
    // First PROVIDER_PRIORITY slug (openrouter-api-key) returns a client key.
    getSecretMock.mockImplementation((_org: string, slug: string) =>
      Promise.resolve(slug === 'openrouter-api-key' ? 'sk-client-or' : null)
    );
  });

  it('sends the client key directly to OpenRouter and never touches the provider factory', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Client-branded copy.' } }],
        usage: { total_tokens: 42 },
      }),
      text: async () => '',
    } as unknown as Response);

    const result = await ClientBrandedContentService.generate(baseRequest);

    // BYOK path uses the raw OpenRouter fetch...
    const openRouterCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('openrouter.ai')
    );
    expect(openRouterCalls.length).toBeGreaterThanOrEqual(1);
    // ...and does NOT use the platform provider factory.
    expect(completeMock).not.toHaveBeenCalled();
    expect(result.credentialSource).toBe('client_vault');
    expect(result.content).toBe('Client-branded copy.');

    fetchSpy.mockRestore();
  });
});
