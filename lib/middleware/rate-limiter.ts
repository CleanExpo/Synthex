/**
 * Rate Limiting Middleware for API Protection
 * Implements per-user and per-tier rate limiting with Upstash Redis backing.
 * Falls back to in-memory storage for local development.
 *
 * ENVIRONMENT VARIABLES:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST endpoint (SECRET, optional)
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST token (SECRET, optional)
 * - REDIS_URL: Alternative Redis URL (SECRET, optional, maps to UPSTASH_REDIS_REST_URL)
 * - REDIS_TOKEN: Alternative Redis token (SECRET, optional, maps to UPSTASH_REDIS_REST_TOKEN)
 *
 * FAILURE MODE: Falls back to in-memory rate limiting if Redis is unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Redis storage layer (Upstash REST API — no extra dependency needed)
// ---------------------------------------------------------------------------

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

/** Increment a key in Upstash, setting TTL on first write. Returns new count. */
async function redisIncr(
  key: string,
  ttlSeconds: number
): Promise<number> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return -1;

  try {
    // INCR + EXPIRE pipeline via Upstash REST
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['TTL', key],
      ]),
    });

    if (!res.ok) {
      logger.warn('Upstash Redis request failed', { status: res.status });
      return -1;
    }

    const results: { result: number }[] = await res.json();
    const count = results[0]?.result ?? 1;
    const ttl = results[1]?.result ?? -1;

    // Set TTL only on first increment (TTL == -1 means no expiry set)
    if (ttl === -1) {
      await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['EXPIRE', key, ttlSeconds]),
      });
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

  // Probabilistic cleanup
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      if (now > v.resetTime) memoryStore.delete(k);
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  identifier?: (req: NextRequest) => string;
}

interface TierLimits {
  free: number;
  professional: number;
  business: number;
  custom: number;
}

const DEFAULT_TIER_LIMITS: TierLimits = {
  free: 100,
  professional: 500,
  business: 2000,
  custom: 10000,
};

const ENDPOINT_LIMITS: Record<string, TierLimits> = {
  '/api/ai/generate-content': {
    free: 5,
    professional: 20,
    business: 100,
    custom: 500,
  },
  '/api/social/post': {
    free: 10,
    professional: 50,
    business: 200,
    custom: 1000,
  },
  '/api/analytics': {
    free: 30,
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
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `ip:${ip}`;
  }

  async getUserTier(userId: string): Promise<string> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
      );

      const { data } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single();

      return data?.plan || 'free';
    } catch {
      return 'free';
    }
  }

  async check(
    req: NextRequest
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
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

  static createHeaders(result: {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }) {
    return {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory + middleware helpers (unchanged API surface)
// ---------------------------------------------------------------------------

export function createRateLimiter(
  endpoint: string,
  tier: string = 'free'
): RateLimiter {
  const endpointLimits = ENDPOINT_LIMITS[endpoint];
  const maxRequests = endpointLimits
    ? endpointLimits[tier as keyof TierLimits]
    : DEFAULT_TIER_LIMITS[tier as keyof TierLimits];

  return new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests,
  });
}

export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const pathname = new URL(req.url).pathname;

  // Resolve user tier from auth token instead of hardcoding 'free'
  let tier = 'free';
  try {
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('auth-token')?.value;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload?.userId) {
          const tempLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });
          tier = await tempLimiter.getUserTier(payload.userId);
        }
      }
    }
  } catch {
    // Fall back to 'free' tier on any error
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
        headers: RateLimiter.createHeaders(result),
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
// Usage tracking (unchanged)
// ---------------------------------------------------------------------------

export class UsageTracker {
  static async track(
    userId: string,
    feature: string,
    count: number = 1
  ) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
      );

      await supabase.from('usage_tracking').insert({
        user_id: userId,
        feature,
        count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Usage tracking error', { error });
    }
  }

  static async checkLimit(
    userId: string,
    feature: string,
    tier: string = 'free'
  ): Promise<boolean> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
      );

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', userId)
        .eq('feature', feature)
        .gte('timestamp', startOfMonth.toISOString());

      if (error) throw error;

      const totalUsage =
        data?.reduce((sum, record) => sum + record.count, 0) || 0;

      const limits: Record<string, Record<string, number>> = {
        ai_posts: { free: 5, professional: 100, business: -1, custom: -1 },
        social_posts: {
          free: 10,
          professional: 100,
          business: -1,
          custom: -1,
        },
        api_calls: {
          free: 1000,
          professional: 10000,
          business: 100000,
          custom: -1,
        },
      };

      const limit = limits[feature]?.[tier] || 0;
      return limit === -1 || totalUsage < limit;
    } catch (error) {
      logger.error('Limit check error', { error });
      return true;
    }
  }
}

// ---------------------------------------------------------------------------
// Express-compatible rate limiter (unchanged API surface)
// ---------------------------------------------------------------------------

export function createExpressRateLimiter(
  options?: Partial<RateLimitConfig>
) {
  const config: RateLimitConfig = {
    windowMs: options?.windowMs || 15 * 60 * 1000,
    maxRequests: options?.maxRequests || 100,
  };

  return async (req: { url: string; headers: Headers }, res: { set: (key: string, value: string) => void; status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const limiter = new RateLimiter(config);
    const nextReq = new NextRequest(req.url, {
      headers: req.headers,
    });

    const result = await limiter.check(nextReq);

    res.set('X-RateLimit-Limit', config.maxRequests.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: new Date(result.resetTime).toISOString(),
      });
    }

    next();
  };
}
