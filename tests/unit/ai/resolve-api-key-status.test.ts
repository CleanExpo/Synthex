/**
 * Unit tests — resolveApiKeyConfigured
 */

const findFirstCredential = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aPICredential: {
      findFirst: (...args: unknown[]) => findFirstCredential(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
    },
  },
}));

import {
  resolveApiKeyConfigured,
  userHasStoredCredential,
} from '@/lib/ai/resolve-api-key-status';

describe('resolveApiKeyConfigured', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    findUniqueUser.mockResolvedValue({ apiKeyConfigured: false });
    findFirstCredential.mockResolvedValue(null);
  });

  it('returns true when platform OPENROUTER_API_KEY is set', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    await expect(resolveApiKeyConfigured('user-1')).resolves.toBe(true);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns true when user.apiKeyConfigured is true', async () => {
    findUniqueUser.mockResolvedValue({ apiKeyConfigured: true });
    await expect(resolveApiKeyConfigured('user-1')).resolves.toBe(true);
    expect(findFirstCredential).not.toHaveBeenCalled();
  });

  it('returns true when user has a stored BYOK credential', async () => {
    findFirstCredential.mockResolvedValue({ id: 'cred-1' });
    await expect(userHasStoredCredential('user-1')).resolves.toBe(true);
    await expect(resolveApiKeyConfigured('user-1')).resolves.toBe(true);
  });

  it('returns false when no platform key, flag, or credential', async () => {
    await expect(resolveApiKeyConfigured('user-1')).resolves.toBe(false);
  });
});
