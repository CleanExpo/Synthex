/**
 * Redis-Backed Distributed Rate Limiter
 *
 * @description Production-grade rate limiting with Redis:
 * - Sliding window algorithm for accurate limiting
 * - Distributed across multiple server instances
 * - Graceful degradation to in-memory on Redis failure
 * - IP-based and user-based rate limiting
 * - Configurable limits per endpoint
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (CRITICAL)
 * - RATE_LIMIT_ENABLED: Enable rate limiting (default: true)
 */

import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Skip rate limiting for certain conditions */
  skip?: (identifier: string) => boolean;
  /** Custom error message */
  message?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Time until the window resets (ms) */
  resetIn: number;
  /** Whether rate limiting was applied (false if skipped/error) */
  applied: boolean;
}

export interface RateLimitInfo {
  identifier: string;
  endpoint: string;
  requests: number;
  limit: number;
  windowMs: number;
  blocked: boolean;
  timestamp: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '';
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

// Default rate limits by tier
export const RATE_LIMIT_TIERS = {
  FREE: { maxRequests: 100, windowMs: 60000 },      // 100/min
  STARTER: { maxRequests: 300, windowMs: 60000 },   // 300/min
  PRO: { maxRequests: 1000, windowMs: 60000 },      // 1000/min
  ENTERPRISE: { maxRequests: 5000, windowMs: 60000 }, // 5000/min
  INTERNAL: { maxRequests: 10000, windowMs: 60000 }, // 10000/min
} as const;

// Endpoint-specific limits
export const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { maxRequests: 5, windowMs: 300000 },      // 5/5min (brute force protection)
  '/api/auth/register': { maxRequests: 3, windowMs: 3600000 },  // 3/hour
  '/api/auth/forgot-password': { maxRequests: 3, windowMs: 3600000 }, // 3/hour
  '/api/generate': { maxRequests: 30, windowMs: 60000 },        // 30/min (AI generation)
  '/api/content/generate': { maxRequests: 30, windowMs: 60000 },
  '/api/webhooks': { maxRequests: 1000, windowMs: 60000 },      // 1000/min (webhooks)
  'default': { maxRequests: 100, windowMs: 60000 },             // Default: 100/min
};

// ============================================================================
// REDIS CLIENT
// ============================================================================

let redisClient: Redis | null = null;
let redisConnected = false;

function getRedisClient(): Redis | null {
  if (!REDIS_URL) {
    return null;
  }

  if (redisClient) {
    return redisConnected ? redisClient : null;
  }

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      connectTimeout: 5000,
    });

    redisClient.on('connect', () => {
      redisConnected = true;
      logger.info('Redis rate limiter connected');
    });

    redisClient.on('error', (error) => {
      redisConnected = false;
      logger.error('Redis rate limiter error', { error: error instanceof Error ? error.message : String(error) });
    });

    redisClient.on('close', () => {
      redisConnected = false;
      logger.warn('Redis rate limiter disconnected');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to create Redis client', { error });
    return null;
  }
}

// ============================================================================
// IN-MEMORY FALLBACK
// ============================================================================

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const MEMORY_CLEANUP_INTERVAL = 60000; // 1 minute

// Cleanup expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, MEMORY_CLEANUP_INTERVAL);
}

async function checkMemoryLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    memoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
      resetIn: config.windowMs,
      applied: true,
    };
  }

  // Existing window
  entry.count++;
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    limit: config.maxRequests,
    resetIn: entry.resetAt - now,
    applied: true,
  };
}

// ============================================================================
// REDIS RATE LIMITING (Sliding Window)
// ============================================================================

async function checkRedisLimit(
  redis: Redis,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Lua script for atomic operation
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local maxRequests = tonumber(ARGV[3])
      local windowMs = tonumber(ARGV[4])

      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

      -- Count current requests
      local count = redis.call('ZCARD', key)

      if count < maxRequests then
        -- Add new request
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        redis.call('PEXPIRE', key, windowMs)
        return {1, maxRequests - count - 1, maxRequests}
      else
        -- Denied
        return {0, 0, maxRequests}
      end
    `;

    const result = await redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      windowStart.toString(),
      config.maxRequests.toString(),
      config.windowMs.toString()
    ) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      limit: result[2],
      resetIn: config.windowMs,
      applied: true,
    };
  } catch (error) {
    logger.error('Redis rate limit check failed', { error, key });
    // Fallback to memory on error
    return checkMemoryLimit(key, config);
  }
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private defaultConfig: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.defaultConfig = {
      maxRequests: 100,
      windowMs: 60000,
      keyPrefix: 'rl:',
      ...config,
    };
  }

  /**
   * Check if a request should be rate limited
   */
  async check(
    identifier: string,
    endpoint?: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    // Skip if rate limiting disabled
    if (!RATE_LIMIT_ENABLED) {
      return {
        allowed: true,
        remaining: Infinity,
        limit: Infinity,
        resetIn: 0,
        applied: false,
      };
    }

    // Merge configs
    const endpointConfig = endpoint ? ENDPOINT_LIMITS[endpoint] || ENDPOINT_LIMITS['default'] : ENDPOINT_LIMITS['default'];
    const finalConfig: RateLimitConfig = {
      ...this.defaultConfig,
      ...endpointConfig,
      ...config,
    };

    // Check skip condition
    if (finalConfig.skip?.(identifier)) {
      return {
        allowed: true,
        remaining: finalConfig.maxRequests,
        limit: finalConfig.maxRequests,
        resetIn: 0,
        applied: false,
      };
    }

    // Build key
    const key = `${finalConfig.keyPrefix}${endpoint || 'global'}:${identifier}`;

    // Try Redis first
    const redis = getRedisClient();
    if (redis && redisConnected) {
      return checkRedisLimit(redis, key, finalConfig);
    }

    // Fallback to memory
    return checkMemoryLimit(key, finalConfig);
  }

  /**
   * Get rate limit info for an identifier
   */
  async getInfo(identifier: string, endpoint?: string): Promise<RateLimitInfo | null> {
    const endpointConfig = endpoint ? ENDPOINT_LIMITS[endpoint] || ENDPOINT_LIMITS['default'] : ENDPOINT_LIMITS['default'];
    const key = `${this.defaultConfig.keyPrefix}${endpoint || 'global'}:${identifier}`;

    const redis = getRedisClient();
    if (redis && redisConnected) {
      try {
        const count = await redis.zcard(key);
        return {
          identifier,
          endpoint: endpoint || 'global',
          requests: count,
          limit: endpointConfig.maxRequests,
          windowMs: endpointConfig.windowMs,
          blocked: count >= endpointConfig.maxRequests,
          timestamp: new Date(),
        };
      } catch (error) {
        logger.error('Failed to get rate limit info', { error, key });
      }
    }

    // Memory fallback
    const entry = memoryStore.get(key);
    if (entry) {
      return {
        identifier,
        endpoint: endpoint || 'global',
        requests: entry.count,
        limit: endpointConfig.maxRequests,
        windowMs: endpointConfig.windowMs,
        blocked: entry.count >= endpointConfig.maxRequests,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, endpoint?: string): Promise<boolean> {
    const key = `${this.defaultConfig.keyPrefix}${endpoint || 'global'}:${identifier}`;

    // Reset in memory
    memoryStore.delete(key);

    // Reset in Redis
    const redis = getRedisClient();
    if (redis && redisConnected) {
      try {
        await redis.del(key);
        return true;
      } catch (error) {
        logger.error('Failed to reset rate limit in Redis', { error, key });
      }
    }

    return true;
  }

  /**
   * Block an identifier temporarily
   */
  async block(identifier: string, durationMs: number, reason?: string): Promise<void> {
    const key = `${this.defaultConfig.keyPrefix}blocked:${identifier}`;

    const redis = getRedisClient();
    if (redis && redisConnected) {
      try {
        await redis.set(key, reason || 'blocked', 'PX', durationMs);
        logger.warn('Identifier blocked', { identifier, durationMs, reason });
      } catch (error) {
        logger.error('Failed to block identifier', { error, identifier });
      }
    }
  }

  /**
   * Check if an identifier is blocked
   */
  async isBlocked(identifier: string): Promise<{ blocked: boolean; reason?: string }> {
    const key = `${this.defaultConfig.keyPrefix}blocked:${identifier}`;

    const redis = getRedisClient();
    if (redis && redisConnected) {
      try {
        const reason = await redis.get(key);
        return { blocked: !!reason, reason: reason || undefined };
      } catch (error) {
        logger.error('Failed to check block status', { error, identifier });
      }
    }

    return { blocked: false };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract identifier from request (IP or user ID)
 */
export function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Get IP from headers (common reverse proxy headers)
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip');

  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0].trim() || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + result.resetIn / 1000).toString(),
    'Retry-After': result.allowed ? '' : Math.ceil(result.resetIn / 1000).toString(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const rateLimiter = new RateLimiter();
export default rateLimiter;
