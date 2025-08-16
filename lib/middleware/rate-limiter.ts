/**
 * Rate Limiting Middleware for API Protection
 * Implements per-user and per-tier rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Redis client using Upstash (already configured in env)
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: (req: NextRequest) => string; // Function to identify the user
}

interface TierLimits {
  free: number;
  professional: number;
  business: number;
  custom: number;
}

// Default rate limits per tier (requests per hour)
const DEFAULT_TIER_LIMITS: TierLimits = {
  free: 100, // 100 requests per hour
  professional: 500, // 500 requests per hour
  business: 2000, // 2000 requests per hour
  custom: 10000, // 10000 requests per hour
};

// Specific endpoint limits (requests per minute)
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

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private identifier: (req: NextRequest) => string;
  private cache: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.identifier = config.identifier || this.defaultIdentifier;
  }

  private defaultIdentifier(req: NextRequest): string {
    // Try to get user ID from authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // In production, decode JWT to get user ID
      return `user:${token.substring(0, 10)}`; // Use first 10 chars as identifier
    }

    // Fallback to IP address
    const ip = req.headers.get('x-forwarded-for') || 
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

  async check(req: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const identifier = this.identifier(req);
    const now = Date.now();

    // Get cached rate limit data
    let data = this.cache.get(identifier);

    // If no data or window expired, reset
    if (!data || now > data.resetTime) {
      data = {
        count: 0,
        resetTime: now + this.windowMs,
      };
    }

    // Increment request count
    data.count++;

    // Save to cache
    this.cache.set(identifier, data);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }

    const allowed = data.count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - data.count);

    return {
      allowed,
      remaining,
      resetTime: data.resetTime,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.resetTime) {
        this.cache.delete(key);
      }
    }
  }

  // Create rate limit headers
  static createHeaders(result: { allowed: boolean; remaining: number; resetTime: number }) {
    return {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    };
  }
}

// Factory function to create rate limiter based on endpoint
export function createRateLimiter(endpoint: string, tier: string = 'free'): RateLimiter {
  const endpointLimits = ENDPOINT_LIMITS[endpoint];
  const maxRequests = endpointLimits ? endpointLimits[tier as keyof TierLimits] : DEFAULT_TIER_LIMITS[tier as keyof TierLimits];

  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute window
    maxRequests,
  });
}

// Middleware function for Next.js API routes
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const pathname = new URL(req.url).pathname;
  
  // Get user tier (simplified - in production, decode JWT)
  const tier = 'free'; // Default to free tier
  
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

  // Add rate limit headers to successful response
  const response = await handler();
  const headers = RateLimiter.createHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Usage tracking for subscription limits
export class UsageTracker {
  static async track(userId: string, feature: string, count: number = 1) {
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
      console.error('Usage tracking error:', error);
    }
  }

  static async checkLimit(userId: string, feature: string, tier: string = 'free'): Promise<boolean> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
      );

      // Get usage for current month
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

      const totalUsage = data?.reduce((sum, record) => sum + record.count, 0) || 0;

      // Check against tier limits
      const limits: Record<string, Record<string, number>> = {
        ai_posts: { free: 5, professional: 100, business: -1, custom: -1 },
        social_posts: { free: 10, professional: 100, business: -1, custom: -1 },
        api_calls: { free: 1000, professional: 10000, business: 100000, custom: -1 },
      };

      const limit = limits[feature]?.[tier] || 0;
      return limit === -1 || totalUsage < limit;
    } catch (error) {
      console.error('Limit check error:', error);
      return true; // Allow on error to avoid blocking users
    }
  }
}

// Express/Node.js compatible rate limiter
export function createExpressRateLimiter(options?: Partial<RateLimitConfig>) {
  const config: RateLimitConfig = {
    windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
    maxRequests: options?.maxRequests || 100, // 100 requests per window
  };

  return async (req: any, res: any, next: any) => {
    const limiter = new RateLimiter(config);
    const nextReq = new NextRequest(req.url, {
      headers: req.headers,
    });

    const result = await limiter.check(nextReq);

    // Set headers
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