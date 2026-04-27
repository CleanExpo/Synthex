/**
 * Unit tests — SYN-799 rate-limit wrapper
 *
 * Covers:
 *  - Under-limit passes
 *  - At-limit (edge) still passes
 *  - Over-limit returns ok:false with positive retryAfterSeconds
 *  - Org and IP counters are independent
 *  - Window boundary resets the counter
 *  - IP extraction rejects garbage in x-forwarded-for
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Force in-memory backend — Redis env vars must be absent.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.REDIS_URL;
delete process.env.REDIS_TOKEN;

import {
  checkRateLimit,
  extractClientIp,
  __resetRateLimitBackendForTests,
} from '@/lib/auth/rate-limit';
import type { NextRequest } from 'next/server';

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    __resetRateLimitBackendForTests();
  });

  const baseOptions = {
    namespace: 'test',
    orgKey: 'org-A',
    ipKey: '1.1.1.1',
    limits: {
      org: { limit: 3, windowSeconds: 60 },
      ip: { limit: 5, windowSeconds: 60 },
    },
  };

  it('allows requests under the org limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await checkRateLimit(null, baseOptions);
      expect(res.ok).toBe(true);
    }
  });

  it('allows exactly at the limit (edge case)', async () => {
    // 3rd hit is still within limit: count goes 1, 2, 3 — all <= 3.
    const results = [];
    for (let i = 0; i < 3; i += 1) {
      results.push(await checkRateLimit(null, baseOptions));
    }
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('blocks the first request over the org limit with positive retryAfterSeconds', async () => {
    for (let i = 0; i < 3; i += 1) await checkRateLimit(null, baseOptions);
    const res = await checkRateLimit(null, baseOptions);
    expect(res.ok).toBe(false);
    expect(res.breachedBucket).toBe('org');
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('keeps org and IP counters independent — one breach does not affect the other', async () => {
    // Fill org bucket for org-A
    for (let i = 0; i < 3; i += 1) {
      await checkRateLimit(null, baseOptions);
    }
    const blockedA = await checkRateLimit(null, baseOptions);
    expect(blockedA.ok).toBe(false);
    expect(blockedA.breachedBucket).toBe('org');

    // Different org, same IP — org bucket is fresh. IP bucket has 4 hits
    // already (the 3 allowed + the 1 blocked still incremented org first,
    // not IP — so IP is at 3). Limit is 5.
    const otherOrg = {
      ...baseOptions,
      orgKey: 'org-B',
    };
    const res = await checkRateLimit(null, otherOrg);
    expect(res.ok).toBe(true);
  });

  it('blocks on IP bucket when IP is the one that breaches', async () => {
    // Per-org limit: 100 (plenty). Per-IP limit: 2. Use three distinct orgs
    // from the same IP.
    const cfg = {
      namespace: 'ipbreach',
      ipKey: '9.9.9.9',
      limits: {
        org: { limit: 100, windowSeconds: 60 },
        ip: { limit: 2, windowSeconds: 60 },
      },
    };
    expect((await checkRateLimit(null, { ...cfg, orgKey: 'o1' })).ok).toBe(
      true
    );
    expect((await checkRateLimit(null, { ...cfg, orgKey: 'o2' })).ok).toBe(
      true
    );
    const res = await checkRateLimit(null, { ...cfg, orgKey: 'o3' });
    expect(res.ok).toBe(false);
    expect(res.breachedBucket).toBe('ip');
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the counter after the window elapses', async () => {
    jest.useFakeTimers();
    try {
      const cfg = {
        namespace: 'window',
        orgKey: 'org-W',
        ipKey: '2.2.2.2',
        limits: {
          org: { limit: 2, windowSeconds: 10 },
          ip: { limit: 100, windowSeconds: 10 },
        },
      };

      jest.setSystemTime(new Date('2026-04-24T10:00:00.000Z'));
      expect((await checkRateLimit(null, cfg)).ok).toBe(true);
      expect((await checkRateLimit(null, cfg)).ok).toBe(true);
      expect((await checkRateLimit(null, cfg)).ok).toBe(false);

      // Advance past the 10s window — bucket should be fresh again.
      jest.advanceTimersByTime(11_000);
      expect((await checkRateLimit(null, cfg)).ok).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('extractClientIp', () => {
  it('reads the first entry from x-forwarded-for and validates it', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
    expect(extractClientIp(req)).toBe('203.0.113.7');
  });

  it('falls through to cf-connecting-ip when xff is invalid', () => {
    const req = makeReq({
      'x-forwarded-for': 'not-an-ip',
      'cf-connecting-ip': '198.51.100.2',
    });
    expect(extractClientIp(req)).toBe('198.51.100.2');
  });

  it('returns "unknown" when no header contains a valid IP', () => {
    const req = makeReq({ 'x-forwarded-for': 'garbage' });
    expect(extractClientIp(req)).toBe('unknown');
  });

  it('accepts IPv6 addresses', () => {
    const req = makeReq({ 'x-forwarded-for': '2001:db8::1' });
    expect(extractClientIp(req)).toBe('2001:db8::1');
  });
});
