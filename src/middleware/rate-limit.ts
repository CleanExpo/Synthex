/**
 * Rate Limiting Middleware
 * Provides flexible rate limiting using Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/redis-unified';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  message?: string;
  handler?: (req: NextRequest, info: RateLimitInfo) => Promise<NextResponse | void>;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

// Default configurations for different endpoints
export const RATE_LIMIT_PRESETS = {
  strict: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests, please slow down'
  },
  standard: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests, please try again later'
  },
  relaxed: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded'
  },
  auth: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts'
  },
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute per minute
    message: 'API rate limit exceeded'
  },
  upload: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Upload limit exceeded'
  }
};

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Priority: authenticated user > IP address > fallback
  const userId = request.cookies.get('user-id')?.value || 
                 request.headers.get('x-user-id');
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // Get client IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS,
  handler?: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Get configuration
  const rateLimitConfig: RateLimitConfig = 
    typeof config === 'string' 
      ? RATE_LIMIT_PRESETS[config]
      : config;
  
  const {
    limit,
    windowMs,
    keyPrefix = request.nextUrl.pathname,
    standardHeaders = true,
    legacyHeaders = false,
    message = 'Too many requests',
    handler: customHandler
  } = rateLimitConfig;
  
  try {
    // Get client identifier
    const clientId = getClientIdentifier(request);
    const rateLimitKey = `ratelimit:${keyPrefix}:${clientId}`;
    
    // Check rate limit
    const result = await checkRateLimit(rateLimitKey, limit, windowMs);
    
    // Calculate rate limit info
    const info: RateLimitInfo = {
      limit,
      current: result.count,
      remaining: Math.max(0, limit - result.count),
      resetTime: new Date(result.resetTime),
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    };
    
    // Set rate limit headers on all responses
    const headers = new Headers();
    
    if (standardHeaders) {
      headers.set('RateLimit-Limit', limit.toString());
      headers.set('RateLimit-Remaining', info.remaining.toString());
      headers.set('RateLimit-Reset', info.resetTime.toISOString());
    }
    
    if (legacyHeaders) {
      headers.set('X-RateLimit-Limit', limit.toString());
      headers.set('X-RateLimit-Remaining', info.remaining.toString());
      headers.set('X-RateLimit-Reset', Math.floor(result.resetTime / 1000).toString());
    }
    
    // If rate limit exceeded
    if (!result.allowed) {
      // Use custom handler if provided
      if (customHandler) {
        const customResponse = await customHandler(request, info);
        if (customResponse) {
          // Add headers to custom response
          for (const [key, value] of headers.entries()) {
            customResponse.headers.set(key, value);
          }
          return customResponse;
        }
      }
      
      // Default rate limit response
      headers.set('Retry-After', info.retryAfter.toString());
      
      return NextResponse.json(
        {
          error: message,
          retryAfter: info.retryAfter,
          resetTime: info.resetTime.toISOString()
        },
        { 
          status: 429,
          headers
        }
      );
    }
    
    // Rate limit not exceeded - continue with handler
    if (handler) {
      const response = await handler(request);
      // Add rate limit headers to successful response
      for (const [key, value] of headers.entries()) {
        response.headers.set(key, value);
      }
      return response;
    }
    
    // If no handler provided, return headers for middleware chaining
    return NextResponse.next({
      headers
    });
    
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    
    // On error, allow request to continue but log warning
    if (handler) {
      return handler(request);
    }
    
    return NextResponse.next();
  }
}

/**
 * Create rate limiter for specific configuration
 */
export function createRateLimiter(config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS) {
  return (request: NextRequest, handler?: (request: NextRequest) => Promise<NextResponse>) => 
    withRateLimit(request, config, handler);
}

/**
 * Rate limit decorator for API routes
 */
export function rateLimit(config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS = 'standard') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      return withRateLimit(request, config, async (req) => {
        return originalMethod.call(this, req, ...args);
      });
    };
    
    return descriptor;
  };
}

/**
 * IP-based rate limiting
 */
export async function ipRateLimit(
  request: NextRequest,
  limit: number = 60,
  windowMs: number = 60000
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown';
  
  const result = await checkRateLimit(`ip:${ip}`, limit, windowMs);
  
  return {
    allowed: result.allowed,
    info: {
      limit,
      current: result.count,
      remaining: Math.max(0, limit - result.count),
      resetTime: new Date(result.resetTime),
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    }
  };
}

/**
 * User-based rate limiting
 */
export async function userRateLimit(
  userId: string,
  endpoint: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const result = await checkRateLimit(`user:${userId}:${endpoint}`, limit, windowMs);
  
  return {
    allowed: result.allowed,
    info: {
      limit,
      current: result.count,
      remaining: Math.max(0, limit - result.count),
      resetTime: new Date(result.resetTime),
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    }
  };
}