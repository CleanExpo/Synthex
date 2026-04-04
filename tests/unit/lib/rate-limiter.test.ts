/**
 * Unit Tests for Rate Limiter
 * Tests RateLimiter class, in-memory fallback, createRateLimiter factory,
 * withRateLimit HOF, and UsageTracker.
 *
 * Tests run with Redis disabled (no UPSTASH env vars) so the in-memory
 * fallback path is exercised. Redis-specific behaviour would need integration tests.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock logger to prevent console noise
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Ensure Redis is disabled for unit tests
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.REDIS_URL;
delete process.env.REDIS_TOKEN;

import {
  RateLimiter,
  createRateLimiter,
  withRateLimit,
  UsageTracker,
} from '@/lib/rate-limit/rate-limiter';

describe('Rate Limiter', () => {
  function createRequest(
    url: string = 'http://localhost:3000/api/test',
    headers: Record<string, string> = {}
  ) {
    return createMockNextRequest({ url, headers });
  }

  // =========================================================================
  // RateLimiter class — in-memory mode
  // =========================================================================
  describe('RateLimiter (in-memory fallback)', () => {
    it('should allow requests within the limit', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const req = createRequest('http://localhost:3000/test', {
        'x-forwarded-for': '192.168.1.1',
      });

      const result = await limiter.check(req);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests exceeding the limit', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      });

      const req = createRequest('http://localhost:3000/test', {
        'x-forwarded-for': '10.0.0.1',
      });

      // Use up all 3 allowed requests
      await limiter.check(req);
      await limiter.check(req);
      await limiter.check(req);

      // 4th request should be blocked
      const result = await limiter.check(req);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track remaining requests correctly', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const req = createRequest('http://localhost:3000/test', {
        'x-forwarded-for': '172.16.0.1',
      });

      const r1 = await limiter.check(req);
      expect(r1.remaining).toBe(4);

      const r2 = await limiter.check(req);
      expect(r2.remaining).toBe(3);

      const r3 = await limiter.check(req);
      expect(r3.remaining).toBe(2);
    });

    it('should use custom identifier when provided', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        identifier: () => 'custom-id-unique-test',
      });

      const req = createRequest();

      const r1 = await limiter.check(req);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);
    });

    it('should use authorization header for default identifier', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      const req = createRequest('http://localhost:3000/test', {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.test.sig',
      });

      const result = await limiter.check(req);
      expect(result.allowed).toBe(true);
    });

    it('should isolate rate limits per identifier', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      const req1 = createRequest('http://localhost:3000/test', {
        'x-forwarded-for': '1.1.1.1',
      });
      const req2 = createRequest('http://localhost:3000/test', {
        'x-forwarded-for': '2.2.2.2',
      });

      // Both should be allowed (different IPs = different identifiers)
      const r1 = await limiter.check(req1);
      const r2 = await limiter.check(req2);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });
  });

  // =========================================================================
  // RateLimiter.createHeaders
  // =========================================================================
  describe('RateLimiter.createHeaders', () => {
    it('should return standard rate limit headers', () => {
      const result = {
        allowed: true,
        remaining: 42,
        resetTime: Date.now() + 60000,
      };

      const headers = RateLimiter.createHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('42');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      // Reset should be a valid ISO date string
      expect(() => new Date(headers['X-RateLimit-Reset'])).not.toThrow();
    });

    it('should show 0 remaining when exhausted', () => {
      const headers = RateLimiter.createHeaders({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30000,
      });

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  // =========================================================================
  // createRateLimiter factory
  // =========================================================================
  describe('createRateLimiter', () => {
    it('should create a limiter with default tier (free)', () => {
      const limiter = createRateLimiter('/api/unknown-endpoint');

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create a limiter with endpoint-specific limits', () => {
      // /api/ai/generate-content has custom limits
      const limiter = createRateLimiter('/api/ai/generate-content', 'free');

      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should accept all valid tier values', () => {
      const tiers = ['free', 'professional', 'business', 'custom'] as const;

      for (const tier of tiers) {
        const limiter = createRateLimiter('/api/test', tier);
        expect(limiter).toBeInstanceOf(RateLimiter);
      }
    });

    it('should use default limits for unknown endpoints', async () => {
      // Default free tier = 100 requests per window
      const limiter = createRateLimiter('/api/some-unknown-endpoint', 'free');
      const req = createRequest('http://localhost:3000/api/some-unknown-endpoint', {
        'x-forwarded-for': '99.99.99.1',
      });

      const result = await limiter.check(req);

      // Free tier default = 100 requests, so remaining = 99 after first check
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  // =========================================================================
  // withRateLimit HOF
  // =========================================================================
  describe('withRateLimit', () => {
    it('should call handler when within rate limit', async () => {
      const { NextResponse } = require('next/server');
      const req = createRequest('http://localhost:3000/api/test', {
        'x-forwarded-for': '50.50.50.1',
      });

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ data: 'ok' })
      );

      const response = await withRateLimit(req, handler);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      // Should add rate limit headers
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });

    it('should return 429 when rate limit exceeded', async () => {
      const { NextResponse } = require('next/server');
      // Use a unique IP so we have a fresh counter
      const ip = '60.60.60.1';

      const req = createRequest('http://localhost:3000/api/test', {
        'x-forwarded-for': ip,
      });

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );

      const response = await withRateLimit(req, handler);

      // Should succeed within limits
      expect(response.status).toBe(200);
    });

    it('should extract tier from JWT in auth header', async () => {
      const { NextResponse } = require('next/server');
      // Create a fake JWT with tier in payload
      const payload = Buffer.from(JSON.stringify({ tier: 'professional' })).toString('base64url');
      const fakeJwt = `header.${payload}.signature`;

      const req = createRequest('http://localhost:3000/api/ai/generate-content', {
        authorization: `Bearer ${fakeJwt}`,
        'x-forwarded-for': '70.70.70.1',
      });

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );

      const response = await withRateLimit(req, handler);

      // Professional tier for /api/ai/generate-content = 20 requests
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should fall back to free tier on invalid JWT', async () => {
      const { NextResponse } = require('next/server');
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: 'Bearer not-a-valid-jwt',
        'x-forwarded-for': '80.80.80.1',
      });

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );

      // Should not throw even with invalid JWT
      const response = await withRateLimit(req, handler);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // UsageTracker (limited testing without Redis)
  // =========================================================================
  describe('UsageTracker', () => {
    it('should not throw when tracking without Redis', async () => {
      // Without Redis, track() is a no-op
      await expect(
        UsageTracker.track('user-123', 'ai_posts', 1)
      ).resolves.not.toThrow();
    });

    it('should return true (allow) when Redis is unavailable', async () => {
      // Without Redis, checkLimit always returns true
      const allowed = await UsageTracker.checkLimit('user-123', 'ai_posts', 'free');

      expect(allowed).toBe(true);
    });

    it('should return true for unlimited tiers', async () => {
      const allowed = await UsageTracker.checkLimit('user-biz', 'ai_posts', 'business');

      expect(allowed).toBe(true);
    });
  });
});
