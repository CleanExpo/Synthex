/**
 * Enhanced Sliding Window Rate Limiter
 *
 * Implements sliding window rate limiting with Redis support,
 * per-endpoint configuration, and user/IP-based limiting.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (INTERNAL)
 * - UPSTASH_REDIS_REST_URL: Upstash Redis URL (INTERNAL)
 * - UPSTASH_REDIS_REST_TOKEN: Upstash token (SECRET)
 *
 * @module lib/rate-limiter-enhanced
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
  /** Requests per window */
  limit: number;
  /** Window size in seconds */
  window: number;
  /** Custom identifier function */
  identifier?: (req: NextRequest) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: NextRequest) => boolean;
  /** Custom error message */
  message?: string;
  /** Headers to add to response */
  headers?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface SlidingWindowEntry {
  count: number;
  timestamps: number[];
}

// =============================================================================
// Sliding Window Algorithm
// =============================================================================

/**
 * In-memory sliding window store
 * Falls back to this when Redis is unavailable
 */
const memoryStore = new Map<string, SlidingWindowEntry>();

/**
 * Clean expired entries from memory store
 */
function cleanMemoryStore(windowMs: number): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    const validTimestamps = entry.timestamps.filter(
      (ts) => now - ts < windowMs
    );
    if (validTimestamps.length === 0) {
      memoryStore.delete(key);
    } else {
      entry.timestamps = validTimestamps;
      entry.count = validTimestamps.length;
    }
  }
}

/**
 * Sliding window rate limit check using memory
 */
function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup (1% of requests)
  if (Math.random() < 0.01) {
    cleanMemoryStore(windowMs);
  }

  let entry = memoryStore.get(key);

  if (!entry) {
    entry = { count: 0, timestamps: [] };
    memoryStore.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
  entry.count = entry.timestamps.length;

  const reset = now + windowMs;

  if (entry.count >= limit) {
    const oldestTimestamp = Math.min(...entry.timestamps);
    const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    return {
      success: false,
      limit,
      remaining: 0,
      reset,
      retryAfter,
    };
  }

  // Add new timestamp
  entry.timestamps.push(now);
  entry.count++;

  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset,
  };
}

// =============================================================================
// Redis Integration
// =============================================================================

/**
 * Redis client singleton
 */
let redisClient: RedisClient | null = null;

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
  del: (key: string) => Promise<void>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<void>;
  zadd: (key: string, score: number, member: string) => Promise<void>;
  zrangebyscore: (key: string, min: number, max: number) => Promise<string[]>;
  zremrangebyscore: (key: string, min: number, max: number) => Promise<number>;
  zcard: (key: string) => Promise<number>;
}

/**
 * Initialize Redis client (supports Upstash REST API)
 */
async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    console.warn('Redis not configured, falling back to memory store');
    return null;
  }

  // Upstash REST client
  redisClient = {
    async get(key: string) {
      const res = await fetch(`${upstashUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const data = await res.json();
      return data.result;
    },
    async set(key: string, value: string, options?: { EX?: number }) {
      const url = options?.EX
        ? `${upstashUrl}/set/${key}/${value}/ex/${options.EX}`
        : `${upstashUrl}/set/${key}/${value}`;
      await fetch(url, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
    },
    async del(key: string) {
      await fetch(`${upstashUrl}/del/${key}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
    },
    async incr(key: string) {
      const res = await fetch(`${upstashUrl}/incr/${key}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const data = await res.json();
      return data.result;
    },
    async expire(key: string, seconds: number) {
      await fetch(`${upstashUrl}/expire/${key}/${seconds}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
    },
    async zadd(key: string, score: number, member: string) {
      await fetch(`${upstashUrl}/zadd/${key}/${score}/${member}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
    },
    async zrangebyscore(key: string, min: number, max: number) {
      const res = await fetch(`${upstashUrl}/zrangebyscore/${key}/${min}/${max}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const data = await res.json();
      return data.result || [];
    },
    async zremrangebyscore(key: string, min: number, max: number) {
      const res = await fetch(`${upstashUrl}/zremrangebyscore/${key}/${min}/${max}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const data = await res.json();
      return data.result || 0;
    },
    async zcard(key: string) {
      const res = await fetch(`${upstashUrl}/zcard/${key}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const data = await res.json();
      return data.result || 0;
    },
  };

  return redisClient;
}

/**
 * Sliding window rate limit check using Redis sorted sets
 */
async function checkRedisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = await getRedisClient();

  if (!redis) {
    return checkMemoryRateLimit(key, limit, windowMs);
  }

  try {
    const now = Date.now();
    const windowStart = now - windowMs;
    const uniqueId = `${now}-${Math.random().toString(36).substr(2, 9)}`;

    // Remove expired entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const count = await redis.zcard(key);

    if (count >= limit) {
      const retryAfter = Math.ceil(windowMs / 1000);
      return {
        success: false,
        limit,
        remaining: 0,
        reset: now + windowMs,
        retryAfter,
      };
    }

    // Add new request
    await redis.zadd(key, now, uniqueId);
    await redis.expire(key, Math.ceil(windowMs / 1000));

    return {
      success: true,
      limit,
      remaining: limit - count - 1,
      reset: now + windowMs,
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

// =============================================================================
// Rate Limit Middleware
// =============================================================================

/**
 * Create rate limit headers
 */
function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Default identifier function
 */
function defaultIdentifier(req: NextRequest): string {
  // Try user ID from auth header
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    // Use a hash of the token for privacy
    return `user:${hashString(token.substring(0, 20))}`;
  }

  // Fall back to IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Simple string hash
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    limit,
    window,
    identifier = defaultIdentifier,
    skip,
    message = 'Too many requests, please try again later.',
    headers = true,
  } = config;

  const windowMs = window * 1000;

  return async function rateLimitMiddleware(
    req: NextRequest
  ): Promise<{ allowed: boolean; response?: NextResponse; headers?: Record<string, string> }> {
    // Check if should skip
    if (skip && skip(req)) {
      return { allowed: true };
    }

    const key = `ratelimit:${identifier(req)}:${new URL(req.url).pathname}`;
    const result = await checkRedisRateLimit(key, limit, windowMs);

    const rateLimitHeaders = headers ? createRateLimitHeaders(result) : undefined;

    if (!result.success) {
      const response = NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message,
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: result.remaining,
          reset: new Date(result.reset).toISOString(),
        },
        { status: 429 }
      );

      if (rateLimitHeaders) {
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      return { allowed: false, response, headers: rateLimitHeaders };
    }

    return { allowed: true, headers: rateLimitHeaders };
  };
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  /** Auth endpoints: 10 req/min */
  auth: {
    limit: 10,
    window: 60,
    message: 'Too many authentication attempts. Please wait before trying again.',
  },

  /** AI generation: 5 req/min */
  aiGeneration: {
    limit: 5,
    window: 60,
    message: 'AI generation rate limit exceeded. Please wait before generating more content.',
  },

  /** Analytics: 30 req/min */
  analytics: {
    limit: 30,
    window: 60,
    message: 'Analytics rate limit exceeded.',
  },

  /** General API: 60 req/min */
  general: {
    limit: 60,
    window: 60,
    message: 'Too many requests, please try again later.',
  },

  /** Write operations: 20 req/min */
  write: {
    limit: 20,
    window: 60,
    message: 'Too many write operations. Please slow down.',
  },

  /** Expensive operations: 10 req/hour */
  expensive: {
    limit: 10,
    window: 3600,
    message: 'This operation is rate limited. Please try again later.',
  },

  /** Export operations: 5 req/hour */
  export: {
    limit: 5,
    window: 3600,
    message: 'Export rate limit exceeded. Please wait before exporting again.',
  },

  /** Webhook callbacks: 100 req/min */
  webhook: {
    limit: 100,
    window: 60,
    message: 'Webhook rate limit exceeded.',
  },
};

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  auth: createRateLimiter(rateLimitConfigs.auth),
  aiGeneration: createRateLimiter(rateLimitConfigs.aiGeneration),
  analytics: createRateLimiter(rateLimitConfigs.analytics),
  general: createRateLimiter(rateLimitConfigs.general),
  write: createRateLimiter(rateLimitConfigs.write),
  expensive: createRateLimiter(rateLimitConfigs.expensive),
  export: createRateLimiter(rateLimitConfigs.export),
  webhook: createRateLimiter(rateLimitConfigs.webhook),
};

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Apply rate limiting to an API route handler
 *
 * @example
 * ```ts
 * import { withRateLimit, rateLimitConfigs } from '@/lib/rate-limiter-enhanced';
 *
 * export const POST = withRateLimit(
 *   rateLimitConfigs.aiGeneration,
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  const limiter = createRateLimiter(config);

  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const { allowed, response, headers } = await limiter(req);

    if (!allowed && response) {
      return response;
    }

    const result = await handler(req, context);

    // Add rate limit headers to successful response
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        result.headers.set(key, value);
      });
    }

    return result;
  };
}

// =============================================================================
// Tiered Rate Limiting
// =============================================================================

export interface TierConfig {
  free: number;
  professional: number;
  business: number;
  enterprise: number;
}

/**
 * Rate limits per tier for different operations
 */
export const tierLimits: Record<string, TierConfig> = {
  general: {
    free: 60,
    professional: 300,
    business: 1000,
    enterprise: 10000,
  },
  aiGeneration: {
    free: 5,
    professional: 50,
    business: 200,
    enterprise: 1000,
  },
  analytics: {
    free: 30,
    professional: 100,
    business: 500,
    enterprise: 2000,
  },
  export: {
    free: 2,
    professional: 10,
    business: 50,
    enterprise: 200,
  },
};

/**
 * Get tier from user ID (to be implemented with actual user lookup)
 */
export async function getUserTier(userId: string): Promise<keyof TierConfig> {
  // This would typically look up the user's subscription
  // For now, return 'free' as default
  return 'free';
}

/**
 * Create a tier-aware rate limiter
 */
export function createTieredRateLimiter(
  operation: keyof typeof tierLimits,
  window: number = 60
) {
  return async function tieredLimiter(
    req: NextRequest,
    tier: keyof TierConfig = 'free'
  ): Promise<{ allowed: boolean; response?: NextResponse; headers?: Record<string, string> }> {
    const limit = tierLimits[operation]?.[tier] || tierLimits.general[tier];
    const limiter = createRateLimiter({ limit, window });
    return limiter(req);
  };
}
