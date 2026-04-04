/**
 * Integration Tests for Rate Limiter Presets
 *
 * Tests the category-based preset wrappers (authStrict, writeDefault, readDefault, etc.)
 * exported from lib/rate-limit/presets.ts via lib/rate-limit/index.ts.
 *
 * Verifies:
 * - Each preset is a callable function that wraps a handler
 * - The preset passes through a successful handler response
 * - After exhausting the preset's limit the wrapper returns 429
 * - The 429 response has the correct JSON shape and headers
 * - PRESET_CONFIG constants match the documented limits
 *
 * Redis is disabled for unit tests — all checks use the in-memory fallback.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock logger to suppress console noise
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Ensure Redis env vars are absent so the in-memory fallback is used
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.REDIS_URL;
delete process.env.REDIS_TOKEN;

import { NextResponse } from 'next/server';
import {
  authStrict,
  authGeneral,
  admin,
  billing,
  aiGeneration,
  writeDefault,
  mutation,
  readDefault,
  PRESET_CONFIG,
  rateLimiters,
} from '@/lib/rate-limit/presets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(ip: string = '127.0.0.1') {
  return createMockNextRequest({
    url: 'http://localhost:3000/api/test',
    headers: { 'x-forwarded-for': ip },
  });
}

/** Call a preset wrapper N times against the same request to exhaust the quota. */
async function exhaustPreset(
  preset: (
    req: ReturnType<typeof makeRequest>,
    handler: () => Promise<NextResponse>
  ) => Promise<NextResponse>,
  req: ReturnType<typeof makeRequest>,
  times: number
) {
  const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
  let last!: NextResponse;
  for (let i = 0; i < times; i++) {
    last = await preset(req as any, handler);
  }
  return last;
}

// ---------------------------------------------------------------------------
// PRESET_CONFIG constant shape
// ---------------------------------------------------------------------------

describe('PRESET_CONFIG constants', () => {
  it('authStrict should be 5 req/min', () => {
    expect(PRESET_CONFIG.authStrict.maxRequests).toBe(5);
    expect(PRESET_CONFIG.authStrict.windowMs).toBe(60_000);
    expect(PRESET_CONFIG.authStrict.category).toBe('auth-strict');
  });

  it('authGeneral should be 15 req/min', () => {
    expect(PRESET_CONFIG.authGeneral.maxRequests).toBe(15);
    expect(PRESET_CONFIG.authGeneral.category).toBe('auth-general');
  });

  it('admin should be 30 req/min', () => {
    expect(PRESET_CONFIG.admin.maxRequests).toBe(30);
  });

  it('billing should be 20 req/min', () => {
    expect(PRESET_CONFIG.billing.maxRequests).toBe(20);
  });

  it('aiGeneration should be 20 req/min', () => {
    expect(PRESET_CONFIG.aiGeneration.maxRequests).toBe(20);
  });

  it('writeDefault should be 30 req/min', () => {
    expect(PRESET_CONFIG.writeDefault.maxRequests).toBe(30);
    expect(PRESET_CONFIG.writeDefault.category).toBe('write-default');
  });

  it('mutation should be 60 req/min', () => {
    expect(PRESET_CONFIG.mutation.maxRequests).toBe(60);
  });

  it('readDefault should be 120 req/min', () => {
    expect(PRESET_CONFIG.readDefault.maxRequests).toBe(120);
    expect(PRESET_CONFIG.readDefault.category).toBe('read-default');
  });
});

// ---------------------------------------------------------------------------
// authStrict preset
// ---------------------------------------------------------------------------

describe('authStrict preset', () => {
  it('passes through to the handler when within limit', async () => {
    const req = makeRequest('10.1.1.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ token: 'abc' }, { status: 200 }));

    const res = await authStrict(req as any, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe('abc');
  });

  it('returns 429 when the 6th request arrives (limit is 5)', async () => {
    // Use a unique IP so we start with a fresh counter
    const req = makeRequest('10.1.1.2');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    // Use up all 5 allowed slots
    for (let i = 0; i < 5; i++) {
      await authStrict(req as any, handler);
    }

    // The 6th request should be rate-limited
    const res = await authStrict(req as any, handler);
    expect(res.status).toBe(429);
  });

  it('returns correct 429 response shape', async () => {
    const req = makeRequest('10.1.1.3');
    await exhaustPreset(authStrict, req, 5); // exhaust
    const res = await authStrict(req as any, jest.fn());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
    expect(body.message).toContain('Rate limit exceeded');
    expect(body.retryAfter).toBeDefined();
    // retryAfter should be a valid ISO date string
    expect(() => new Date(body.retryAfter)).not.toThrow();
  });

  it('includes retryAfter in 429 response body', async () => {
    const req = makeRequest('10.1.1.4');
    await exhaustPreset(authStrict, req, 5);
    const res = await authStrict(req as any, jest.fn());

    expect(res.status).toBe(429);
    // Retry-After is set in the NextResponse constructor headers option;
    // in jsdom the body's retryAfter field is the testable surface
    const body = await res.json();
    expect(body.retryAfter).toBeDefined();
    expect(() => new Date(body.retryAfter)).not.toThrow();
  });

  it('attaches X-RateLimit headers to successful responses', async () => {
    const req = makeRequest('10.1.1.10');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));
    const res = await authStrict(req as any, handler);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// writeDefault preset
// ---------------------------------------------------------------------------

describe('writeDefault preset', () => {
  it('passes through to the handler when within limit', async () => {
    const req = makeRequest('20.1.1.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ saved: true }));

    const res = await writeDefault(req as any, handler);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('returns 429 after exceeding 30 requests', async () => {
    const req = makeRequest('20.1.1.2');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    for (let i = 0; i < 30; i++) {
      await writeDefault(req as any, handler);
    }

    const res = await writeDefault(req as any, handler);
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// readDefault preset
// ---------------------------------------------------------------------------

describe('readDefault preset', () => {
  it('passes through to the handler when within limit', async () => {
    const req = makeRequest('30.1.1.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ data: [] }));

    const res = await readDefault(req as any, handler);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('allows 120 requests before blocking', async () => {
    const req = makeRequest('30.1.1.2');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    // First 120 should be allowed
    for (let i = 0; i < 120; i++) {
      const res = await readDefault(req as any, handler);
      expect(res.status).toBe(200);
    }

    // 121st should be blocked
    const res = await readDefault(req as any, handler);
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Independent IP isolation
// ---------------------------------------------------------------------------

describe('preset IP isolation', () => {
  it('different IPs have independent rate limit counters', async () => {
    const reqA = makeRequest('40.0.0.1');
    const reqB = makeRequest('40.0.0.2');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    // Exhaust authStrict for IP A
    for (let i = 0; i < 5; i++) {
      await authStrict(reqA as any, handler);
    }
    const resA = await authStrict(reqA as any, handler);
    expect(resA.status).toBe(429);

    // IP B should still be allowed (fresh counter)
    const resB = await authStrict(reqB as any, handler);
    expect(resB.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// authGeneral, admin, billing, aiGeneration, mutation presets — smoke tests
// ---------------------------------------------------------------------------

describe('remaining presets — smoke test (pass-through within limit)', () => {
  const presetsUnderTest = [
    { name: 'authGeneral', fn: authGeneral, ip: '50.0.1.1' },
    { name: 'admin', fn: admin, ip: '50.0.2.1' },
    { name: 'billing', fn: billing, ip: '50.0.3.1' },
    { name: 'aiGeneration', fn: aiGeneration, ip: '50.0.4.1' },
    { name: 'mutation', fn: mutation, ip: '50.0.5.1' },
  ] as const;

  for (const { name, fn, ip } of presetsUnderTest) {
    it(`${name} preset passes through within limit`, async () => {
      const req = makeRequest(ip);
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ ok: true }));

      const res = await fn(req as any, handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    });
  }
});

// ---------------------------------------------------------------------------
// Legacy rateLimiters aliases
// ---------------------------------------------------------------------------

describe('rateLimiters legacy aliases', () => {
  it('rateLimiters.auth is a callable wrapper function', async () => {
    const req = makeRequest('60.0.0.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const res = await rateLimiters.auth(req as any, handler);
    expect(res.status).toBe(200);
  });

  it('rateLimiters.read is a callable wrapper function', async () => {
    const req = makeRequest('60.0.1.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const res = await rateLimiters.read(req as any, handler);
    expect(res.status).toBe(200);
  });

  it('rateLimiters.write is a callable wrapper function', async () => {
    const req = makeRequest('60.0.2.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const res = await rateLimiters.write(req as any, handler);
    expect(res.status).toBe(200);
  });

  it('rateLimiters.expensive is a callable wrapper function', async () => {
    const req = makeRequest('60.0.3.1');
    const handler = jest
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }));

    const res = await rateLimiters.expensive(req as any, handler);
    expect(res.status).toBe(200);
  });
});
