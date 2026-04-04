/**
 * Core Rate Limiter Implementation
 *
 * Uses Upstash Redis in production with in-memory fallback for local dev.
 * This is the canonical rate limiter - all other implementations should use this.
 *
 * ENVIRONMENT VARIABLES:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST endpoint (optional)
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST token (optional)
 * - REDIS_URL: Alternative Redis URL (maps to UPSTASH_REDIS_REST_URL)
 * - REDIS_TOKEN: Alternative Redis token (maps to UPSTASH_REDIS_REST_TOKEN)
 *
 * FAILURE MODE: Falls back to in-memory rate limiting if Redis is unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitHeaders,
  SubscriptionTier,
  TierLimits,
} from './types';

// ---------------------------------------------------------------------------
// Redis storage layer (Upstash SDK — serverless-safe)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getUpstashClient(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  if (!url || !token) return null;

  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

const useRedis = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN)
);

/** Increment a key in Upstash, setting TTL on first write. Returns new count. */
/** 2s timeout guard — prevents misconfigured Redis from hanging requests */
function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis timeout')), 2000)
    ),
  ]);
}

async function redisIncr(key: string, ttlSeconds: number): Promise<number> {
  const redis = getUpstashClient();
  if (!redis) return -1;

  try {
    // Pipeline: INCR + TTL (2s timeout — misconfigured Redis must not hang requests)
    const results = await withRedisTimeout(
      redis.pipeline().incr(key).ttl(key).exec()
    );

    const count = (results[0] as number) ?? 1;
    const ttl = (results[1] as number) ?? -1;

    // Set TTL only on first increment (TTL == -1 means no expiry set)
    if (ttl === -1) {
      await withRedisTimeout(redis.expire(key, ttlSeconds));
    }

    return count;
  } catch (error) {
    logger.warn('Redis rate-limit call failed, using in-memory fallback', {
      error,
    });
    return -1; // signal caller to use in-memory fallback
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (for local dev or Redis failures)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryIncr(
  key: string,
  windowMs: number
): { count: number; resetTime: number } {
  const now = Date.now();
  let entry = memoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
  }

  entry.count++;
  memoryStore.set(key, entry);

  // Probabilistic cleanup (1% chance per call)
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      if (now > v.resetTime) memoryStore.delete(k);
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Verified tier resolution (DB-backed, Redis-cached)
// ---------------------------------------------------------------------------

// Prisma Subscription.plan → SubscriptionTier mapping
const PLAN_TO_TIER: Record<string, SubscriptionTier> = {
  free: 'free',
  pro: 'pro',
  professional: 'professional',
  growth: 'growth',
  business: 'business',
  scale: 'scale',
  custom: 'custom',
};

/**
 * Resolve subscription tier for a verified user ID.
 * Redis cache (5 min TTL) prevents a DB call on every request.
 * Falls back to 'free' on any error — never elevates on failure.
 */
async function resolveVerifiedTier(userId: string): Promise<SubscriptionTier> {
  // Try Redis cache first
  const redis = getUpstashClient();
  const cacheKey = `rate-limit:tier:${userId}`;
  if (redis) {
    try {
      const cached = await withRedisTimeout(redis.get<string>(cacheKey));
      if (cached && cached in PLAN_TO_TIER) return cached as SubscriptionTier;
    } catch {
      /* fall through */
    }
  }

  // DB lookup
  try {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
    const isActive = sub?.status === 'active' || sub?.status === 'trialing';
    const tier: SubscriptionTier = isActive
      ? (PLAN_TO_TIER[sub?.plan ?? 'free'] ?? 'free')
      : 'free';

    // Cache for 5 minutes
    if (redis) {
      redis.set(cacheKey, tier, { ex: 300 }).catch(() => {});
    }
    return tier;
  } catch {
    return 'free';
  }
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_TIER_LIMITS: TierLimits = {
  free: 100,
  pro: 500,
  growth: 2000,
  scale: 10000,
  // Backward-compat aliases
  professional: 500,
  business: 2000,
  custom: 10000,
};

const ENDPOINT_LIMITS: Record<string, TierLimits> = {
  '/api/ai/generate-content': {
    free: 5,
    pro: 20,
    growth: 100,
    scale: 500,
    professional: 20,
    business: 100,
    custom: 500,
  },
  '/api/social/post': {
    free: 10,
    pro: 50,
    growth: 200,
    scale: 1000,
    professional: 50,
    business: 200,
    custom: 1000,
  },
  '/api/analytics': {
    free: 30,
    pro: 100,
    growth: 500,
    scale: 2000,
    professional: 100,
    business: 500,
    custom: 2000,
  },
};

// ---------------------------------------------------------------------------
// RateLimiter class
// ---------------------------------------------------------------------------

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private identifier: (req: NextRequest) => string;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.identifier = config.identifier || this.defaultIdentifier;
  }

  private defaultIdentifier(req: NextRequest): string {
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      return `user:${token.substring(0, 10)}`;
    }

    const ip =
      req.headers.get('x-vercel-forwarded-for') ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      'unknown';
    return `ip:${ip}`;
  }

  async check(req: NextRequest): Promise<RateLimitResult> {
    const id = this.identifier(req);
    const windowSec = Math.ceil(this.windowMs / 1000);
    const redisKey = `rl:${id}`;

    // Try Redis first
    if (useRedis) {
      const count = await redisIncr(redisKey, windowSec);
      if (count >= 0) {
        const allowed = count <= this.maxRequests;
        const remaining = Math.max(0, this.maxRequests - count);
        return {
          allowed,
          remaining,
          resetTime: Date.now() + this.windowMs,
        };
      }
      // count === -1 means Redis failed → fall through to in-memory
    }

    // In-memory fallback
    const entry = memoryIncr(id, this.windowMs);
    const allowed = entry.count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    return { allowed, remaining, resetTime: entry.resetTime };
  }

  static createHeaders(result: RateLimitResult): RateLimitHeaders {
    return {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create a rate limiter for a specific endpoint and subscription tier.
 */
export function createRateLimiter(
  endpoint: string,
  tier: SubscriptionTier = 'free'
): RateLimiter {
  const endpointLimits = ENDPOINT_LIMITS[endpoint];
  const maxRequests = endpointLimits
    ? endpointLimits[tier]
    : DEFAULT_TIER_LIMITS[tier];

  return new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests,
  });
}

/**
 * Higher-order function that wraps a handler with rate limiting.
 * Automatically resolves user tier from auth token.
 */
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const pathname = new URL(req.url).pathname;

  // Resolve user tier from verified auth — never trust unverified JWT payload
  let tier: SubscriptionTier = 'free';
  try {
    const userId = await getUserIdFromRequestOrCookies(req);
    if (userId) {
      tier = await resolveVerifiedTier(userId);
    }
  } catch {
    // Default to 'free' tier on any error — never elevate on failure
  }

  const limiter = createRateLimiter(pathname, tier);
  const result = await limiter.check(req);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: new Date(result.resetTime).toISOString(),
      },
      {
        status: 429,
        headers: { ...RateLimiter.createHeaders(result) },
      }
    );
  }

  const response = await handler();
  const headers = RateLimiter.createHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// ---------------------------------------------------------------------------
// Usage Tracker (for subscription-based feature limits)
// ---------------------------------------------------------------------------

/**
 * Tracks feature usage for subscription limit enforcement.
 */
export class UsageTracker {
  /**
   * Track usage of a feature for a user.
   */
  static async track(
    userId: string,
    feature: string,
    count: number = 1
  ): Promise<void> {
    try {
      const redis = getUpstashClient();
      if (useRedis && redis) {
        const key = `usage:${userId}:${feature}:${new Date().toISOString().slice(0, 7)}`; // monthly key
        await redis.incrby(key, count);
      }
    } catch (error) {
      logger.error('Usage tracking error', { error, userId, feature });
    }
  }

  /**
   * Check if a user is within their usage limits for a feature.
   */
  static async checkLimit(
    userId: string,
    feature: string,
    tier: SubscriptionTier = 'free'
  ): Promise<boolean> {
    const limits: Record<string, Record<SubscriptionTier, number>> = {
      ai_posts: {
        free: 5,
        pro: 100,
        growth: -1,
        scale: -1,
        professional: 100,
        business: -1,
        custom: -1,
      },
      social_posts: {
        free: 10,
        pro: 100,
        growth: -1,
        scale: -1,
        professional: 100,
        business: -1,
        custom: -1,
      },
      api_calls: {
        free: 1000,
        pro: 10000,
        growth: 100000,
        scale: -1,
        professional: 10000,
        business: 100000,
        custom: -1,
      },
    };

    const limit = limits[feature]?.[tier] ?? 0;
    if (limit === -1) return true; // Unlimited

    try {
      const redis = getUpstashClient();
      if (useRedis && redis) {
        const key = `usage:${userId}:${feature}:${new Date().toISOString().slice(0, 7)}`;
        const value = await redis.get<string>(key);
        const count = parseInt(value || '0', 10);
        return count < limit;
      }
      return true; // Allow if Redis not available
    } catch (error) {
      logger.error('Limit check error', { error, userId, feature });
      return true; // Allow on error
    }
  }
}

// Re-export types
export type { RateLimitConfig, RateLimitResult, RateLimitHeaders };
