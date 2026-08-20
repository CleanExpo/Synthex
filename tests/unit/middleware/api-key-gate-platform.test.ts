/**
 * Unit tests — Edge API key gate with platform keys
 */

import { NextRequest } from 'next/server';
import { checkApiKeyGate } from '@/lib/middleware/api-key-gate.edge';

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function makeRequest(token: string) {
  return {
    cookies: {
      get: (name: string) =>
        name === 'auth-token' ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

describe('checkApiKeyGate', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('allows requests when platform key exists even if JWT claim is false', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    const token = makeToken({ userId: 'user-1', apiKeyConfigured: false });

    expect(checkApiKeyGate(makeRequest(token))).toBeNull();
  });

  it('blocks when JWT claim is false and no platform key is configured', () => {
    const token = makeToken({ userId: 'user-1', apiKeyConfigured: false });

    const blocked = checkApiKeyGate(makeRequest(token));
    expect(blocked?.status).toBe(403);
  });
});
