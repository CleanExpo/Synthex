/**
 * Guard for the BYOK credential injector.
 *
 * Regression: PROVIDER_MAP mapped `openai -> 'openrouter'`, so a user's OpenAI
 * secret was sent as a Bearer token to openrouter.ai (failed call + secret leaked
 * to a third party). And a key flagged isValid:false was used anyway.
 *
 * These fire if either regresses.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockFindFirst = jest.fn();
const mockDecrypt = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aPICredential: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
  },
}));
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: (...a: unknown[]) => mockDecrypt(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
jest.mock('@/lib/ai/platform-keys', () => ({ hasPlatformAIKey: jest.fn() }));

import {
  resolveProviderName,
  getUserProviderApiKey,
} from '@/lib/ai/api-credential-injector';

describe('api-credential-injector — provider mapping never leaks keys cross-provider', () => {
  it('routes an OpenAI key to the OpenAI provider, never OpenRouter', () => {
    expect(resolveProviderName('openai')).toBe('openai');
    expect(resolveProviderName('OpenAI')).toBe('openai');
  });

  it('keeps every provider mapped to its own factory', () => {
    expect(resolveProviderName('openrouter')).toBe('openrouter');
    expect(resolveProviderName('anthropic')).toBe('anthropic');
    expect(resolveProviderName('google')).toBe('google');
  });
});

describe('api-credential-injector — invalid keys are refused, not used', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null (does not decrypt) when the stored key was marked invalid', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'cred-1',
      encryptedKey: 'enc',
      isValid: false,
      lastValidatedAt: new Date(),
    });

    const key = await getUserProviderApiKey('user-1', 'openai');

    expect(key).toBeNull();
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('decrypts and returns a valid key', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'cred-2',
      encryptedKey: 'enc',
      isValid: true,
      lastValidatedAt: new Date(),
    });
    mockDecrypt.mockReturnValue('sk-real');

    const key = await getUserProviderApiKey('user-1', 'openai');

    expect(key).toBe('sk-real');
  });
});
