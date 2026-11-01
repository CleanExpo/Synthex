/**
 * AI_PROVIDER set to a removed or unknown provider (e.g. "ollama", PR #1096)
 * must not be substituted silently: resolution warns, then falls back.
 */
const warn = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: { warn: (...a: unknown[]) => warn(...a), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { resolvePlatformProviderName } from '@/lib/ai/providers';

const KEYS = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  warn.mockClear();
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe('resolvePlatformProviderName', () => {
  it('honours a supported AI_PROVIDER without warning', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(resolvePlatformProviderName()).toBe('anthropic');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on the removed ollama value and falls back to a configured key', () => {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OPENROUTER_API_KEY = 'test-key';
    expect(resolvePlatformProviderName()).toBe('openrouter');
    expect(warn).toHaveBeenCalledWith(
      'Unsupported AI_PROVIDER value ignored; falling back',
      expect.objectContaining({ configured: 'ollama' }),
    );
  });

  it('does not warn when AI_PROVIDER is unset', () => {
    expect(resolvePlatformProviderName()).toBe('openai');
    expect(warn).not.toHaveBeenCalled();
  });
});
