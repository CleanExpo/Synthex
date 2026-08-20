/**
 * Unit tests — requireApiKey platform key bypass
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

const verifyTokenSafe = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  verifyTokenSafe: (...args: unknown[]) => verifyTokenSafe(...args),
}));

jest.mock('@/lib/ai/resolve-api-key-status', () => ({
  resolveApiKeyConfigured: jest.fn(),
}));

import { resolveApiKeyConfigured } from '@/lib/ai/resolve-api-key-status';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/middleware/require-api-key';

function makeRequest(token = 'valid-token') {
  return {
    cookies: {
      get: (name: string) =>
        name === 'auth-token' ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

describe('requireApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;

    verifyTokenSafe.mockReturnValue({
      userId: 'user-1',
      apiKeyConfigured: false,
    });
    findUniqueUser.mockResolvedValue({ preferences: {} });
    (resolveApiKeyConfigured as jest.Mock).mockResolvedValue(false);
  });

  it('allows generation when resolveApiKeyConfigured returns true', async () => {
    (resolveApiKeyConfigured as jest.Mock).mockResolvedValue(true);

    const handler = jest.fn(async () =>
      NextResponse.json({ ok: true }, { status: 200 })
    );

    const res = await requireApiKey(makeRequest(), handler);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith('user-1');
  });

  it('returns 402 when resolveApiKeyConfigured returns false', async () => {
    const handler = jest.fn();

    const res = await requireApiKey(makeRequest(), handler);
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.code).toBe('API_KEY_REQUIRED');
    expect(handler).not.toHaveBeenCalled();
  });
});
