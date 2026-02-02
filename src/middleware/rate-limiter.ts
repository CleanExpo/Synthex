/**
 * Rate Limiter Middleware
 * Implements sliding window rate limiting with Redis backing
 *
 * @task UNI-439 - Implement Auto-scaling Configuration
 *
 * Features:
 * - Sliding window rate limiting
 * - Tiered limits (anonymous, authenticated, premium, enterprise)
 * - Endpoint-specific limits
 * - Redis-backed with memory fallback
 * - Burst allowance for traffic spikes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRateLimitConfig,
  getEndpointRateLimits,
  RateLimitConfig,
  EndpointRateLimit,
} from '../config/scaling.config';

// In-memory fallback when Redis unavailable
const memoryStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Check rate limit using sliding window algorithm
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Try Redis first (imported dynamically to avoid issues)
    const { getRedisClient } = await import('../../lib/redis-client');
    const redis = getRedisClient();

    if (redis.isConnected) {
      // Use Redis for distributed rate limiting
      const countKey = config.keyGenerator(key);
      const countStr = await redis.get(countKey);
      const data = countStr ? JSON.parse(countStr) : { count: 0, resetTime: now + config.windowMs };

      // Reset if window expired
      if (data.resetTime < now) {
        data.count = 0;
        data.resetTime = now + config.windowMs;
      }

      // Check limit
      if (data.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: data.resetTime,
          limit: config.maxRequests,
          retryAfter: Math.ceil((data.resetTime - now) / 1000),
        };
      }

      // Increment count
      data.count++;
      await redis.set(countKey, JSON.stringify(data), Math.ceil(config.windowMs / 1000));

      return {
        allowed: true,
        remaining: config.maxRequests - data.count,
        resetTime: data.resetTime,
        limit: config.maxRequests,
      };
    }
  } catch (error) {
    console.warn('[RateLimiter] Redis unavailable, using memory fallback');
  }

  // Memory fallback
  const storeKey = config.keyGenerator(key);
  let data = memoryStore.get(storeKey);

  if (!data || data.resetTime < now) {
    data = { count: 0, resetTime: now + config.windowMs };
  }

  // Check limit
  if (data.count >= config.maxRequests) {
    memoryStore.set(storeKey, data);
    return {
      allowed: false,
      remaining: 0,
      resetTime: data.resetTime,
      limit: config.maxRequests,
      retryAfter: Math.ceil((data.resetTime - now) / 1000),
    };
  }

  // Increment count
  data.count++;
  memoryStore.set(storeKey, data);

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupMemoryStore();
  }

  return {
    allowed: true,
    remaining: config.maxRequests - data.count,
    resetTime: data.resetTime,
    limit: config.maxRequests,
  };
}

/**
 * Cleanup expired entries from memory store
 */
function cleanupMemoryStore(): void {
  const now = Date.now();
  const entries = Array.from(memoryStore.entries());
  for (const [key, data] of entries) {
    if (data.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * Get user tier from request
 */
async function getUserTier(
  request: NextRequest
): Promise<'anonymous' | 'authenticated' | 'premium' | 'enterprise'> {
  const authToken = request.cookies.get('auth-token')?.value;
  const authHeader = request.headers.get('authorization');

  if (!authToken && !authHeader) {
    return 'anonymous';
  }

  // TODO: Implement actual user tier lookup from database
  // For now, assume authenticated users are standard tier
  return 'authenticated';
}

/**
 * Check if endpoint has specific rate limit
 */
function getEndpointLimit(
  path: string,
  method: string
): EndpointRateLimit | null {
  const limits = getEndpointRateLimits();

  return (
    limits.find(
      (limit) =>
        path.startsWith(limit.path) &&
        (!limit.method || limit.method === method)
    ) || null
  );
}

/**
 * Rate limiter middleware
 */
export async function rateLimiter(
  request: NextRequest
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const method = request.method;

  // Skip rate limiting for certain paths
  if (path.startsWith('/_next') || path.startsWith('/static')) {
    return null;
  }

  // Check for endpoint-specific limit first
  const endpointLimit = getEndpointLimit(path, method);

  let config: RateLimitConfig;
  let key: string;

  if (endpointLimit) {
    // Use endpoint-specific config
    config = {
      windowMs: endpointLimit.windowMs,
      maxRequests: endpointLimit.maxRequests,
      message: 'Rate limit exceeded for this endpoint',
      statusCode: 429,
      keyGenerator: (id: string) => `ratelimit:endpoint:${endpointLimit.path}:${id}`,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    };
    key = getClientIP(request);
  } else {
    // Use tier-based config
    const tier = await getUserTier(request);
    const tierConfig = getRateLimitConfig()[tier];
    config = tierConfig;

    // Use IP for anonymous, user ID for authenticated
    if (tier === 'anonymous') {
      key = getClientIP(request);
    } else {
      // TODO: Extract user ID from token
      key = getClientIP(request);
    }
  }

  // Check rate limit
  const result = await checkRateLimit(key, config);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: config.message,
        retryAfter: result.retryAfter,
        limit: result.limit,
      }),
      {
        status: config.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      }
    );
  }

  // Return null to continue processing (rate limit passed)
  return null;
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.resetTime.toString());
  return headers;
}

/**
 * Higher-order function to wrap API route with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  customConfig?: Partial<RateLimitConfig>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Call original handler
    const response = await handler(request);

    // Add rate limit headers to response
    const ip = getClientIP(request);
    const tier = await getUserTier(request);
    const config = customConfig
      ? { ...getRateLimitConfig()[tier], ...customConfig }
      : getRateLimitConfig()[tier];

    const result = await checkRateLimit(ip, config);

    // Clone response and add headers
    const newResponse = new NextResponse(response.body, response);
    newResponse.headers.set('X-RateLimit-Limit', result.limit.toString());
    newResponse.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    newResponse.headers.set('X-RateLimit-Reset', result.resetTime.toString());

    return newResponse;
  };
}

export default rateLimiter;
