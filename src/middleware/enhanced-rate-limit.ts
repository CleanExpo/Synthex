/**
 * Enhanced Rate Limiting with Redis Support
 * Provides distributed rate limiting with user-specific limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheFactory } from '../infrastructure/caching/cache.factory';
import { ConsoleLogger } from '../infrastructure/logging/console-logger';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize services
const logger = new ConsoleLogger();
const cache = CacheFactory.createCacheService(logger);

// Initialize Supabase for user lookups
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  max: number;                // Max requests per window (default)
  maxPerUser?: number;        // Max requests per window for authenticated users
  maxPerPlan?: {             // Max requests per subscription plan
    free: number;
    starter: number;
    pro: number;
    enterprise: number;
  };
  message?: string;           // Custom error message
  keyGenerator?: (req: NextRequest) => Promise<string>; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
  standardHeaders?: boolean;        // Enable standard rate limit headers
  legacyHeaders?: boolean;         // Enable legacy X-RateLimit headers
  store?: 'redis' | 'memory';      // Storage backend
  points?: number;                 // Points consumed per request (for complex limits)
}

interface RateLimitEntry {
  count: number;
  points: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
}

interface UserInfo {
  id: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  customLimit?: number;
}

/**
 * Get user info from JWT token
 */
async function getUserFromToken(token: string): Promise<UserInfo | null> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.sub) {
      return null;
    }
    
    // Get user details from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, subscription_plan, rate_limit_override')
      .eq('id', decoded.sub)
      .single();
    
    if (error || !user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      plan: user.subscription_plan || 'free',
      customLimit: user.rate_limit_override
    };
  } catch (error) {
    logger.error('Error decoding token:', error as Error);
    return null;
  }
}

/**
 * Default key generator with user awareness
 */
async function defaultKeyGenerator(req: NextRequest): Promise<string> {
  // Try to get user from authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    if (user) {
      return `user:${user.id}`;
    }
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ip:${ip}`;
}

/**
 * Enhanced rate limiting middleware
 */
export function enhancedRateLimit(config: RateLimitConfig) {
  const {
    windowMs = 60000,
    max = 100,
    maxPerUser,
    maxPerPlan = {
      free: 100,
      starter: 500,
      pro: 2000,
      enterprise: 10000
    },
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = true,
    store = 'redis',
    points = 1
  } = config;
  
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const key = await keyGenerator(request);
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const resetTime = (window + 1) * windowMs;
    
    // Determine rate limit based on user type
    let limit = max;
    let userInfo: UserInfo | null = null;
    
    if (key.startsWith('user:')) {
      const userId = key.substring(5);
      const { data: user } = await supabase
        .from('users')
        .select('subscription_plan, rate_limit_override')
        .eq('id', userId)
        .single();
      
      if (user) {
        userInfo = {
          id: userId,
          email: '',
          plan: user.subscription_plan || 'free',
          customLimit: user.rate_limit_override
        };
        
        // Use custom limit if set, otherwise use plan limit
        limit = userInfo.customLimit || maxPerPlan[userInfo.plan] || maxPerUser || max;
      }
    }
    
    // Generate cache key with window
    const cacheKey = `rate:${key}:${window}`;
    
    // Get or create rate limit entry
    let entry: RateLimitEntry;
    
    if (store === 'redis') {
      const cached = await cache.get<RateLimitEntry>(cacheKey);
      if (cached) {
        entry = cached;
      } else {
        entry = {
          count: 0,
          points: 0,
          resetTime,
          firstRequest: now,
          lastRequest: now
        };
      }
    } else {
      // Use in-memory store (fallback)
      entry = {
        count: 0,
        points: 0,
        resetTime,
        firstRequest: now,
        lastRequest: now
      };
    }
    
    // Update entry
    entry.count++;
    entry.points += points;
    entry.lastRequest = now;
    
    // Check if limit exceeded
    const limitExceeded = entry.count > limit || entry.points > limit;
    
    if (limitExceeded) {
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      
      // Log rate limit violation
      logger.warn(`Rate limit exceeded for ${key}: ${entry.count}/${limit} requests`);
      
      // Store updated entry even for rejected requests
      if (store === 'redis') {
        await cache.set(cacheKey, entry, Math.ceil(windowMs / 1000));
      }
      
      // Track rate limit violations for analytics
      await cache.increment(`rate:violations:${key}:daily`);
      
      const response = NextResponse.json(
        {
          error: message,
          retryAfter,
          limit,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
          plan: userInfo?.plan,
          upgradeUrl: userInfo ? '/dashboard/billing' : '/signup'
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      if (standardHeaders) {
        response.headers.set('RateLimit-Limit', limit.toString());
        response.headers.set('RateLimit-Remaining', '0');
        response.headers.set('RateLimit-Reset', new Date(resetTime).toISOString());
        response.headers.set('RateLimit-Policy', `${limit};w=${windowMs / 1000}`);
      }
      
      if (legacyHeaders) {
        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
        response.headers.set('Retry-After', retryAfter.toString());
      }
      
      return response;
    }
    
    // Execute handler
    const response = await handler();
    
    // Optionally skip counting based on response status
    const isSuccess = response.status >= 200 && response.status < 300;
    const shouldSkip = (skipSuccessfulRequests && isSuccess) || 
                       (skipFailedRequests && !isSuccess);
    
    if (shouldSkip) {
      // Revert the count
      entry.count--;
      entry.points -= points;
    }
    
    // Store updated entry
    if (store === 'redis') {
      const ttl = Math.ceil((resetTime - now) / 1000);
      await cache.set(cacheKey, entry, ttl);
    }
    
    // Add rate limit headers to response
    const remaining = Math.max(0, limit - entry.count);
    
    if (standardHeaders) {
      response.headers.set('RateLimit-Limit', limit.toString());
      response.headers.set('RateLimit-Remaining', remaining.toString());
      response.headers.set('RateLimit-Reset', new Date(resetTime).toISOString());
      response.headers.set('RateLimit-Policy', `${limit};w=${windowMs / 1000}`);
    }
    
    if (legacyHeaders) {
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
    }
    
    // Add user plan info if available
    if (userInfo) {
      response.headers.set('X-User-Plan', userInfo.plan);
      response.headers.set('X-User-Limit', limit.toString());
    }
    
    return response;
  };
}

/**
 * Pre-configured rate limiters
 */
export const enhancedRateLimiters = {
  // Authentication endpoints - very strict
  auth: enhancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    maxPerUser: 10,
    message: 'Too many authentication attempts. Please try again later.',
    store: 'redis'
  }),
  
  // API endpoints - standard limits per plan
  api: enhancedRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Anonymous users
    maxPerPlan: {
      free: 100,
      starter: 500,
      pro: 2000,
      enterprise: 10000
    },
    store: 'redis'
  }),
  
  // AI generation endpoints - expensive operations
  ai: enhancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Anonymous users
    maxPerPlan: {
      free: 20,
      starter: 100,
      pro: 500,
      enterprise: 5000
    },
    message: 'AI generation limit exceeded. Please upgrade your plan for more requests.',
    points: 10, // Each request costs 10 points
    store: 'redis'
  }),
  
  // File upload endpoints
  upload: enhancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    maxPerPlan: {
      free: 10,
      starter: 50,
      pro: 200,
      enterprise: 1000
    },
    message: 'Upload limit exceeded. Please try again later.',
    store: 'redis'
  }),
  
  // Webhook endpoints - for external services
  webhook: enhancedRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: true, // Don't count failed webhook deliveries
    store: 'redis'
  })
};

/**
 * Get rate limit status for a user
 */
export async function getRateLimitStatus(userId: string): Promise<{
  limits: Record<string, number>;
  usage: Record<string, number>;
  resets: Record<string, string>;
}> {
  const now = Date.now();
  const windows = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };
  
  const limits: Record<string, number> = {};
  const usage: Record<string, number> = {};
  const resets: Record<string, string> = {};
  
  for (const [period, windowMs] of Object.entries(windows)) {
    const window = Math.floor(now / windowMs);
    const cacheKey = `rate:user:${userId}:${window}`;
    const entry = await cache.get<RateLimitEntry>(cacheKey);
    
    if (entry) {
      usage[period] = entry.count;
      resets[period] = new Date(entry.resetTime).toISOString();
    } else {
      usage[period] = 0;
      resets[period] = new Date((window + 1) * windowMs).toISOString();
    }
  }
  
  // Get user's plan limits
  const { data: user } = await supabase
    .from('users')
    .select('subscription_plan, rate_limit_override')
    .eq('id', userId)
    .single();
  
  if (user) {
    const plan = user.subscription_plan || 'free';
    limits.minute = user.rate_limit_override || 
      (plan === 'enterprise' ? 10000 : 
       plan === 'pro' ? 2000 : 
       plan === 'starter' ? 500 : 100);
    limits.hour = limits.minute * 60;
    limits.day = limits.hour * 24;
  }
  
  return { limits, usage, resets };
}

/**
 * Reset rate limits for a user (admin only)
 */
export async function resetRateLimits(userId: string): Promise<void> {
  const patterns = [
    `rate:user:${userId}:*`,
    `rate:violations:user:${userId}:*`
  ];
  
  for (const pattern of patterns) {
    await cache.deletePattern(pattern);
  }
  
  logger.info(`Reset rate limits for user ${userId}`);
}