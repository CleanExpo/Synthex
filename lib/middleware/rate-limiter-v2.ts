/**
 * Rate Limiter v2
 *
 * @description Advanced rate limiting with:
 * - Tiered limits based on tenant plan
 * - Sliding window algorithm
 * - IP-based and user-based limiting
 * - Rate limit headers (X-RateLimit-*)
 * - Redis-backed for distributed systems
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection for distributed rate limiting
 * - UPSTASH_REDIS_REST_URL: Fallback for serverless (optional)
 *
 * FAILURE MODE: Falls back to in-memory limiting on Redis failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Window size in seconds */
  windowSizeSeconds: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Identifier for rate limit bucket */
  identifier: string;
  /** Optional key prefix */
  prefix?: string;
  /** Cost per request (for weighted limiting) */
  cost?: number;
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean;
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
  /** Unix timestamp when window resets */
  resetAt: number;
  /** Retry-After header value (only if blocked) */
  retryAfter?: number;
}

export interface TieredLimits {
  free: RateLimitTier;
  starter: RateLimitTier;
  professional: RateLimitTier;
  enterprise: RateLimitTier;
}

export interface RateLimitTier {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Requests per hour */
  requestsPerHour: number;
  /** Requests per day */
  requestsPerDay: number;
  /** Burst limit (short-term spike allowance) */
  burstLimit: number;
  /** AI API calls per hour */
  aiCallsPerHour: number;
  /** Export operations per day */
  exportsPerDay: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const RATE_LIMIT_TIERS: TieredLimits = {
  free: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 2000,
    burstLimit: 10,
    aiCallsPerHour: 20,
    exportsPerDay: 5,
  },
  starter: {
    requestsPerMinute: 60,
    requestsPerHour: 2000,
    requestsPerDay: 10000,
    burstLimit: 20,
    aiCallsPerHour: 100,
    exportsPerDay: 25,
  },
  professional: {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
    burstLimit: 50,
    aiCallsPerHour: 500,
    exportsPerDay: 100,
  },
  enterprise: {
    requestsPerMinute: 300,
    requestsPerHour: 20000,
    requestsPerDay: 200000,
    burstLimit: 100,
    aiCallsPerHour: 2000,
    exportsPerDay: -1, // Unlimited
  },
};

const WINDOW_SIZES = {
  minute: 60,
  hour: 3600,
  day: 86400,
};

// ============================================================================
// SLIDING WINDOW RATE LIMITER
// ============================================================================

export class SlidingWindowRateLimiter {
  private memoryStore: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly cleanupInterval: number = 60000; // 1 minute

  constructor() {
    // Periodic cleanup of expired entries
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const key = this.buildKey(config);
    const now = Date.now();
    const windowStart = now - config.windowSizeSeconds * 1000;
    const cost = config.cost || 1;

    try {
      // Try Redis first for distributed rate limiting
      const result = await this.checkRedis(key, windowStart, now, config, cost);
      return result;
    } catch (error) {
      // Fallback to memory store
      logger.warn('Redis rate limit failed, using memory fallback', { error });
      return this.checkMemory(key, windowStart, now, config, cost);
    }
  }

  /**
   * Redis-based sliding window check
   */
  private async checkRedis(
    key: string,
    windowStart: number,
    now: number,
    config: RateLimitConfig,
    cost: number
  ): Promise<RateLimitResult> {
    const cache = getCache();

    // Get current window data
    const windowData = await cache.get<Array<{ timestamp: number; cost: number }>>(key);
    const requests = windowData || [];

    // Filter to requests within window
    const validRequests = requests.filter((r) => r.timestamp > windowStart);

    // Calculate current count with weighted costs
    const currentCount = validRequests.reduce((sum, r) => sum + r.cost, 0);

    // Check if allowed
    const allowed = currentCount + cost <= config.maxRequests;

    if (allowed) {
      // Add new request
      validRequests.push({ timestamp: now, cost });

      // Store updated window
      await cache.set(key, validRequests, {
        ttl: config.windowSizeSeconds + 1,
      });
    }

    // Calculate reset time
    const oldestRequest = validRequests.length > 0 ? Math.min(...validRequests.map((r) => r.timestamp)) : now;
    const resetAt = Math.ceil((oldestRequest + config.windowSizeSeconds * 1000) / 1000);
    const resetIn = Math.max(0, resetAt - Math.ceil(now / 1000));

    return {
      allowed,
      current: currentCount + (allowed ? cost : 0),
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? cost : 0)),
      resetIn,
      resetAt,
      retryAfter: allowed ? undefined : resetIn,
    };
  }

  /**
   * Memory-based sliding window check (fallback)
   */
  private checkMemory(
    key: string,
    windowStart: number,
    now: number,
    config: RateLimitConfig,
    cost: number
  ): RateLimitResult {
    const existing = this.memoryStore.get(key);

    // Simple counter for memory fallback
    if (!existing || existing.timestamp < windowStart) {
      // New window
      this.memoryStore.set(key, { count: cost, timestamp: now });
      const resetAt = Math.ceil((now + config.windowSizeSeconds * 1000) / 1000);
      return {
        allowed: true,
        current: cost,
        limit: config.maxRequests,
        remaining: config.maxRequests - cost,
        resetIn: config.windowSizeSeconds,
        resetAt,
      };
    }

    // Existing window
    const currentCount = existing.count;
    const allowed = currentCount + cost <= config.maxRequests;

    if (allowed) {
      existing.count += cost;
    }

    const resetAt = Math.ceil((existing.timestamp + config.windowSizeSeconds * 1000) / 1000);
    const resetIn = Math.max(0, resetAt - Math.ceil(now / 1000));

    return {
      allowed,
      current: existing.count,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - existing.count),
      resetIn,
      resetAt,
      retryAfter: allowed ? undefined : resetIn,
    };
  }

  /**
   * Build cache key
   */
  private buildKey(config: RateLimitConfig): string {
    const prefix = config.prefix || 'ratelimit';
    return `${prefix}:${config.identifier}:${config.windowSizeSeconds}`;
  }

  /**
   * Cleanup expired memory entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = WINDOW_SIZES.day * 1000;

    for (const [key, value] of this.memoryStore.entries()) {
      if (now - value.timestamp > maxAge) {
        this.memoryStore.delete(key);
      }
    }
  }
}

// Singleton instance
const rateLimiter = new SlidingWindowRateLimiter();

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Extract identifier from request (IP, user ID, API key)
 */
export function getIdentifier(request: NextRequest): string {
  // Try API key first
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return `key:${apiKey.slice(0, 8)}`;
  }

  // Try user ID from JWT
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.sub || payload.userId) {
          return `user:${payload.sub || payload.userId}`;
        }
      }
    } catch {
      // Invalid token, use IP
    }
  }

  // Fall back to IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get tenant plan from request
 */
export function getTenantPlan(request: NextRequest): keyof TieredLimits {
  const planHeader = request.headers.get('x-tenant-plan');
  if (planHeader && planHeader in RATE_LIMIT_TIERS) {
    return planHeader as keyof TieredLimits;
  }
  return 'free';
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString());

  if (result.retryAfter) {
    response.headers.set('Retry-After', result.retryAfter.toString());
  }

  return response;
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
      limit: result.limit,
      resetAt: new Date(result.resetAt * 1000).toISOString(),
    },
    { status: 429 }
  );

  return addRateLimitHeaders(response, result);
}

// ============================================================================
// RATE LIMIT MIDDLEWARE
// ============================================================================

export interface RateLimitMiddlewareOptions {
  /** Rate limit type (minute, hour, day) */
  type?: 'minute' | 'hour' | 'day';
  /** Custom limit override */
  customLimit?: number;
  /** Resource category for specific limits */
  category?: 'api' | 'ai' | 'export';
  /** Cost multiplier for expensive operations */
  costMultiplier?: number;
  /** Skip function */
  skip?: (request: NextRequest) => boolean;
}

/**
 * Rate limit middleware factory
 */
export function withRateLimit(
  handler: (request: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse>,
  options: RateLimitMiddlewareOptions = {}
): (request: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse> {
  return async (request, context) => {
    // Check if should skip
    if (options.skip?.(request)) {
      return handler(request, context);
    }

    const identifier = getIdentifier(request);
    const plan = getTenantPlan(request);
    const tier = RATE_LIMIT_TIERS[plan];
    const type = options.type || 'minute';

    // Determine limit based on category and type
    let maxRequests: number;
    if (options.customLimit) {
      maxRequests = options.customLimit;
    } else if (options.category === 'ai') {
      maxRequests = tier.aiCallsPerHour;
    } else if (options.category === 'export') {
      maxRequests = tier.exportsPerDay === -1 ? 999999 : tier.exportsPerDay;
    } else {
      switch (type) {
        case 'minute':
          maxRequests = tier.requestsPerMinute;
          break;
        case 'hour':
          maxRequests = tier.requestsPerHour;
          break;
        case 'day':
          maxRequests = tier.requestsPerDay;
          break;
      }
    }

    // Check rate limit
    const result = await rateLimiter.check({
      identifier,
      windowSizeSeconds: WINDOW_SIZES[type],
      maxRequests,
      prefix: `synthex:${options.category || 'api'}`,
      cost: options.costMultiplier || 1,
    });

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        identifier,
        plan,
        limit: result.limit,
        current: result.current,
        category: options.category || 'api',
      });
      return createRateLimitResponse(result);
    }

    // Call handler and add headers to response
    const response = await handler(request, context);
    return addRateLimitHeaders(response, result);
  };
}

/**
 * Burst rate limiter for short-term spike protection
 */
export async function checkBurstLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request);
  const plan = getTenantPlan(request);
  const tier = RATE_LIMIT_TIERS[plan];

  return rateLimiter.check({
    identifier,
    windowSizeSeconds: 1, // 1-second window for burst
    maxRequests: tier.burstLimit,
    prefix: 'synthex:burst',
  });
}

/**
 * Combined rate limit check (burst + sustained)
 */
export async function checkRateLimits(
  request: NextRequest,
  options: RateLimitMiddlewareOptions = {}
): Promise<{ allowed: boolean; result: RateLimitResult; burstResult?: RateLimitResult }> {
  // Check burst limit first
  const burstResult = await checkBurstLimit(request);
  if (!burstResult.allowed) {
    return { allowed: false, result: burstResult, burstResult };
  }

  // Check sustained limit
  const identifier = getIdentifier(request);
  const plan = getTenantPlan(request);
  const tier = RATE_LIMIT_TIERS[plan];
  const type = options.type || 'minute';

  let maxRequests: number;
  if (options.customLimit) {
    maxRequests = options.customLimit;
  } else {
    switch (type) {
      case 'minute':
        maxRequests = tier.requestsPerMinute;
        break;
      case 'hour':
        maxRequests = tier.requestsPerHour;
        break;
      case 'day':
        maxRequests = tier.requestsPerDay;
        break;
    }
  }

  const result = await rateLimiter.check({
    identifier,
    windowSizeSeconds: WINDOW_SIZES[type],
    maxRequests,
    prefix: `synthex:${options.category || 'api'}`,
    cost: options.costMultiplier || 1,
  });

  return { allowed: result.allowed, result, burstResult };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { rateLimiter };
export default withRateLimit;
