import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (consider using Redis for production)
const rateLimitStore: RateLimitStore = {};

// Clean up old entries on each request (Vercel serverless compatible)
function cleanupOldEntries() {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}

// Note: setInterval doesn't work in serverless environments
// Cleanup happens on each request instead

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
  message?: string;  // Custom error message
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs = 60000,  // 1 minute default
    max = 100,          // 100 requests default
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => {
      // Default: use IP address
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
      return ip;
    }
  } = config;

  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Clean up old entries on each request
    cleanupOldEntries();
    
    const key = keyGenerator(request);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Get or create rate limit entry
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 0,
        resetTime: resetTime
      };
    }

    const entry = rateLimitStore[key];

    // Reset if window has passed
    if (entry.resetTime < now) {
      entry.count = 0;
      entry.resetTime = resetTime;
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      return NextResponse.json(
        { 
          error: message,
          retryAfter: retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
          }
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler();
    
    response.headers.set('X-RateLimit-Limit', max.toString());
    response.headers.set('X-RateLimit-Remaining', (max - entry.count).toString());
    response.headers.set('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    
    return response;
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const rateLimiters = {
  // Strict limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts. Please try again later.'
  }),
  
  // Standard API limit
  api: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  }),
  
  // Generous limit for read operations
  read: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
  }),
  
  // Strict limit for write operations
  write: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: 'Too many write operations. Please slow down.'
  }),
  
  // Very strict limit for expensive operations
  expensive: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: 'This operation is rate limited. Please try again later.'
  })
};