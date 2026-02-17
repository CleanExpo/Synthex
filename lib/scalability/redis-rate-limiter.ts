/**
 * Redis-Backed Rate Limiter
 * Production-ready distributed rate limiting with Redis
 *
 * @task UNI-435 - Scalability & Performance Epic
 *
 * Features:
 * - Distributed rate limiting across multiple instances
 * - Sliding window algorithm for accurate limiting
 * - Memory fallback when Redis unavailable
 * - Configurable by endpoint, user, or IP
 *
 * Usage:
 * ```typescript
 * // In API route
 * const limiter = getRateLimiter('api');
 * const result = await limiter.check(request);
 *
 * if (!result.allowed) {
 *   return new Response('Too Many Requests', {
 *     status: 429,
 *     headers: result.headers,
 *   });
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Redis client
let redis: Redis | null = null;

// Initialize Redis
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.warn('[Rate Limiter] Redis not available, using in-memory fallback');
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Custom error message */
  message?: string;
  /** Key generator function */
  keyGenerator?: (req: NextRequest) => string;
  /** Skip rate limiting for certain conditions */
  skip?: (req: NextRequest) => boolean;
  /** Cost per request (for weighted limiting) */
  cost?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** Remaining requests in window */
  remaining: number;
  /** Seconds until window resets */
  resetIn: number;
  /** Headers to include in response */
  headers: Record<string, string>;
}

/**
 * Rate Limiter class with Redis backend
 */
export class RedisRateLimiter {
  private config: Required<RateLimitConfig>;
  private prefix: string;

  constructor(name: string, config: RateLimitConfig) {
    this.prefix = `ratelimit:${name}`;
    this.config = {
      limit: config.limit,
      window: config.window,
      message: config.message || 'Too many requests, please try again later.',
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false),
      cost: config.cost || 1,
    };
  }

  /**
   * Default key generator using IP address
   */
  private defaultKeyGenerator(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return ip;
  }

  /**
   * Check if request should be rate limited
   */
  async check(request: NextRequest): Promise<RateLimitResult> {
    // Skip if configured
    if (this.config.skip(request)) {
      return this.createResult(true, 0, this.config.window);
    }

    const identifier = this.config.keyGenerator(request);
    const key = `${this.prefix}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.config.window;

    let current: number;
    let oldestTimestamp: number;

    if (redis) {
      // Use Redis sliding window
      const result = await this.checkRedis(key, now, windowStart);
      current = result.current;
      oldestTimestamp = result.oldestTimestamp;
    } else {
      // Fallback to memory store
      const result = this.checkMemory(key, now, windowStart);
      current = result.current;
      oldestTimestamp = result.oldestTimestamp;
    }

    const allowed = current <= this.config.limit;
    const resetIn = Math.max(0, this.config.window - (now - oldestTimestamp));

    return this.createResult(allowed, current, resetIn);
  }

  /**
   * Check rate limit using Redis sliding window
   */
  private async checkRedis(
    key: string,
    now: number,
    windowStart: number
  ): Promise<{ current: number; oldestTimestamp: number }> {
    try {
      // Use Redis sorted set for sliding window
      const pipeline = redis!.pipeline();

      // Remove old entries outside window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Add current request with timestamp as score
      const requestId = `${now}:${crypto.randomUUID()}`;
      pipeline.zadd(key, { score: now, member: requestId });

      // Count requests in window
      pipeline.zcard(key);

      // Get oldest timestamp in window
      pipeline.zrange(key, 0, 0, { withScores: true });

      // Set expiry
      pipeline.expire(key, this.config.window);

      const results = await pipeline.exec();

      const count = (results[2] as number) || 0;
      const oldestEntry = results[3] as Array<{ score: number }> | null;
      const oldestTimestamp = oldestEntry?.[0]?.score || now;

      return { current: count, oldestTimestamp };
    } catch (error) {
      console.error('[Rate Limiter] Redis error, falling back to memory:', error);
      return this.checkMemory(key, now, windowStart);
    }
  }

  /**
   * Check rate limit using memory store
   */
  private checkMemory(
    key: string,
    now: number,
    windowStart: number
  ): { current: number; oldestTimestamp: number } {
    // Clean old entries
    this.cleanupMemoryStore(windowStart);

    const entry = memoryStore.get(key);

    if (!entry || entry.windowStart < windowStart) {
      // New window
      memoryStore.set(key, { count: 1, windowStart: now });
      return { current: 1, oldestTimestamp: now };
    }

    // Increment count
    entry.count += this.config.cost;
    return { current: entry.count, oldestTimestamp: entry.windowStart };
  }

  /**
   * Clean up old memory store entries
   */
  private cleanupMemoryStore(windowStart: number): void {
    if (memoryStore.size > 10000) {
      for (const [key, entry] of memoryStore.entries()) {
        if (entry.windowStart < windowStart) {
          memoryStore.delete(key);
        }
      }
    }
  }

  /**
   * Create rate limit result
   */
  private createResult(allowed: boolean, current: number, resetIn: number): RateLimitResult {
    const remaining = Math.max(0, this.config.limit - current);
    const resetTime = new Date(Date.now() + resetIn * 1000).toISOString();

    return {
      allowed,
      current,
      limit: this.config.limit,
      remaining,
      resetIn,
      headers: {
        'X-RateLimit-Limit': this.config.limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime,
        ...(allowed ? {} : { 'Retry-After': resetIn.toString() }),
      },
    };
  }

  /**
   * Middleware wrapper for API routes
   */
  middleware() {
    return async (
      request: NextRequest,
      handler: () => Promise<NextResponse>
    ): Promise<NextResponse> => {
      const result = await this.check(request);

      if (!result.allowed) {
        return NextResponse.json(
          {
            error: this.config.message,
            retryAfter: result.resetIn,
          },
          {
            status: 429,
            headers: result.headers,
          }
        );
      }

      const response = await handler();

      // Add rate limit headers to successful response
      Object.entries(result.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    };
  }
}

/**
 * Pre-configured rate limiters
 */
const limiters: Record<string, RedisRateLimiter> = {};

export const rateLimiterConfigs = {
  /** Authentication endpoints - very strict */
  auth: {
    limit: 5,
    window: 900, // 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  },

  /** Standard API endpoints */
  api: {
    limit: 100,
    window: 60, // 1 minute
  },

  /** Read-heavy endpoints */
  read: {
    limit: 500,
    window: 60,
  },

  /** Write endpoints */
  write: {
    limit: 30,
    window: 60,
    message: 'Too many write operations. Please slow down.',
  },

  /** AI/Expensive operations */
  ai: {
    limit: 20,
    window: 60,
    message: 'AI request limit reached. Please wait before trying again.',
  },

  /** Webhook endpoints */
  webhook: {
    limit: 1000,
    window: 60,
  },
};

/**
 * Get or create a rate limiter
 */
export function getRateLimiter(
  name: keyof typeof rateLimiterConfigs | string,
  customConfig?: Partial<RateLimitConfig>
): RedisRateLimiter {
  const cacheKey = customConfig ? `${name}:custom` : name;

  if (!limiters[cacheKey]) {
    const baseConfig =
      rateLimiterConfigs[name as keyof typeof rateLimiterConfigs] || rateLimiterConfigs.api;
    limiters[cacheKey] = new RedisRateLimiter(name, {
      ...baseConfig,
      ...customConfig,
    });
  }

  return limiters[cacheKey];
}

/**
 * Rate limit middleware factory
 */
export function withRateLimit(
  name: keyof typeof rateLimiterConfigs | string,
  customConfig?: Partial<RateLimitConfig>
) {
  const limiter = getRateLimiter(name, customConfig);
  return limiter.middleware();
}

/**
 * Simple rate limit check for use in handlers
 */
export async function checkRateLimit(
  request: NextRequest,
  name: keyof typeof rateLimiterConfigs = 'api'
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(name);
  return limiter.check(request);
}

export default RedisRateLimiter;
