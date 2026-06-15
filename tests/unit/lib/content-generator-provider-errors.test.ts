/**
 * Service-level tests for ContentGeneratorService provider-error behaviour.
 *
 * Proves:
 *  - With NO provider key, generateWithAI throws ProviderConfigError (actionable).
 *  - With NO provider key, generateContent throws ProviderConfigError (via the
 *    variations path) instead of silently returning `variations: []` — the bug
 *    that rendered blank variation tabs.
 *  - With a key present but the underlying provider call failing, generateWithAI
 *    throws a ProviderUnavailableError (transient), not a generic Error.
 *  - The template-only success path still works when a key is present and the
 *    provider returns content.
 */

import {
  ContentGeneratorService,
  ProviderConfigError,
} from '@/lib/services/content-generator';

// supabase-client is imported by the module but unused on these paths.
jest.mock('@/lib/supabase-client', () => ({
  db: { content: { create: jest.fn() } },
  supabase: {},
}));

const ORIGINAL_ENV = { ...process.env };

function clearProviderKeys() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('ContentGeneratorService — no provider key configured', () => {
  beforeEach(() => {
    clearProviderKeys();
  });

  it('generateWithAI throws an actionable ProviderConfigError', async () => {
    const svc = new ContentGeneratorService();
    await expect(svc.generateWithAI('hello')).rejects.toBeInstanceOf(
      ProviderConfigError
    );
    await expect(svc.generateWithAI('hello')).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('generateContent throws ProviderConfigError instead of returning blank variations', async () => {
    const svc = new ContentGeneratorService();
    await expect(
      svc.generateContent({ platform: 'twitter', topic: 'coffee' })
    ).rejects.toBeInstanceOf(ProviderConfigError);
  });
});

describe('ContentGeneratorService — provider key present', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
  });

  it('generateWithAI wraps a failing provider call as ProviderUnavailableError', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        models: { balanced: 'gpt-4o-mini' },
        complete: jest.fn().mockRejectedValue(new Error('upstream 500')),
      }),
    }));
    const { ContentGeneratorService: SvcWithMock } = await import(
      '@/lib/services/content-generator'
    );
    const svc = new SvcWithMock();
    // Asserting on the error name (not instanceof) avoids the dual-module-copy
    // identity mismatch introduced by jest.resetModules() + dynamic import.
    const err = await svc.generateWithAI('hello').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('ProviderUnavailableError');
    expect((err as Error).message).toMatch(/AI generation failed/);
  });

  it('generateWithAI returns content on success', async () => {
    jest.doMock('@/lib/ai/providers', () => ({
      getAIProvider: () => ({
        models: { balanced: 'gpt-4o-mini' },
        complete: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'generated text' } }],
        }),
      }),
    }));
    const { ContentGeneratorService: SvcWithMock } = await import(
      '@/lib/services/content-generator'
    );
    const svc = new SvcWithMock();
    await expect(svc.generateWithAI('hello')).resolves.toBe('generated text');
  });
});
