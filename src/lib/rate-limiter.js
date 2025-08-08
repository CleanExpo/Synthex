/**
 * Advanced Rate Limiting System
 * Implements sophisticated rate limiting with Redis support, plan-based limits, and intelligent throttling
 */

import { redisService } from './redis.js';
import { authService } from './auth.js';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Default limits (requests per time window)
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  // Plan-based limits
  plans: {
    free: {
      api: { windowMs: 60 * 60 * 1000, max: 50 }, // 50/hour
      ai: { windowMs: 60 * 60 * 1000, max: 10 }, // 10/hour
      optimize: { windowMs: 60 * 60 * 1000, max: 20 }, // 20/hour
      email: { windowMs: 24 * 60 * 60 * 1000, max: 5 }, // 5/day
      upload: { windowMs: 60 * 60 * 1000, max: 10 } // 10/hour
    },
    pro: {
      api: { windowMs: 60 * 60 * 1000, max: 500 }, // 500/hour
      ai: { windowMs: 60 * 60 * 1000, max: 100 }, // 100/hour
      optimize: { windowMs: 60 * 60 * 1000, max: 200 }, // 200/hour
      email: { windowMs: 24 * 60 * 60 * 1000, max: 50 }, // 50/day
      upload: { windowMs: 60 * 60 * 1000, max: 100 } // 100/hour
    },
    enterprise: {
      api: { windowMs: 60 * 60 * 1000, max: 5000 }, // 5000/hour
      ai: { windowMs: 60 * 60 * 1000, max: 1000 }, // 1000/hour
      optimize: { windowMs: 60 * 60 * 1000, max: 2000 }, // 2000/hour
      email: { windowMs: 24 * 60 * 60 * 1000, max: 500 }, // 500/day
      upload: { windowMs: 60 * 60 * 1000, max: 1000 } // 1000/hour
    }
  },

  // Endpoint-specific overrides
  endpoints: {
    '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 }, // 5 per 15min
    '/api/auth/register': { windowMs: 60 * 60 * 1000, max: 3 }, // 3 per hour
    '/api/auth/reset-password': { windowMs: 60 * 60 * 1000, max: 3 }, // 3 per hour
    '/api/health': { windowMs: 60 * 1000, max: 60 }, // 60 per minute
    '/api/docs': { windowMs: 60 * 1000, max: 30 }, // 30 per minute
    '/api/metrics': { windowMs: 60 * 1000, max: 100 } // 100 per minute
  },

  // IP-based limits for unauthenticated users
  ip: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    trustProxy: true
  },

  // Burst protection
  burst: {
    enabled: true,
    windowMs: 1000, // 1 second
    max: 10 // max requests per second
  }
};

class AdvancedRateLimiter {
  constructor() {
    this.memoryStore = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  // Create rate limiting middleware
  createLimiter(options = {}) {
    const config = {
      ...RATE_LIMIT_CONFIG.default,
      ...options
    };

    return async (req, res, next) => {
      try {
        const result = await this.checkLimit(req, config);
        
        if (!result.allowed) {
          return this.sendRateLimitError(res, result);
        }

        // Add rate limit info to headers
        this.setRateLimitHeaders(res, result);
        
        // Store rate limit info in request for logging
        req.rateLimit = result;
        
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  // Check if request should be rate limited
  async checkLimit(req, config) {
    const keys = this.generateKeys(req);
    const now = Date.now();
    
    // Check burst protection first
    if (RATE_LIMIT_CONFIG.burst.enabled) {
      const burstResult = await this.checkBurstLimit(keys.burst, now);
      if (!burstResult.allowed) {
        return burstResult;
      }
    }

    // Get appropriate limits based on user plan
    const limits = this.getLimitsForRequest(req, config);
    
    // Check main rate limit
    const mainResult = await this.checkMainLimit(keys.main, limits, now);
    
    // Check endpoint-specific limits
    const endpointResult = await this.checkEndpointLimit(req, keys.endpoint, now);
    
    // Return most restrictive result
    if (!mainResult.allowed) return mainResult;
    if (!endpointResult.allowed) return endpointResult;
    
    return mainResult;
  }

  // Generate rate limiting keys
  generateKeys(req) {
    const userId = authService.getUserIdFromRequest(req);
    const ip = this.getClientIP(req);
    const endpoint = this.getEndpointKey(req);
    
    const baseKey = userId ? `user:${userId}` : `ip:${ip}`;
    
    return {
      main: `rate_limit:main:${baseKey}`,
      burst: `rate_limit:burst:${baseKey}`,
      endpoint: `rate_limit:endpoint:${endpoint}:${baseKey}`,
      user: userId,
      ip: ip
    };
  }

  // Get client IP address
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] ||
           '127.0.0.1';
  }

  // Get endpoint key for rate limiting
  getEndpointKey(req) {
    const path = req.route?.path || req.url.split('?')[0];
    
    // Normalize dynamic routes
    return path
      .replace(/\/[0-9]+/g, '/:id') // Replace numeric IDs
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
      .toLowerCase();
  }

  // Get rate limits based on user plan and request context
  getLimitsForRequest(req, baseConfig) {
    const user = req.user;
    const plan = user?.plan || 'free';
    const endpoint = this.getEndpointKey(req);
    
    // Determine limit type based on endpoint
    let limitType = 'api';
    if (endpoint.includes('/ai')) limitType = 'ai';
    else if (endpoint.includes('/optimize')) limitType = 'optimize';
    else if (endpoint.includes('/email')) limitType = 'email';
    else if (endpoint.includes('/upload')) limitType = 'upload';
    
    // Get plan-specific limits
    const planLimits = RATE_LIMIT_CONFIG.plans[plan]?.[limitType] || RATE_LIMIT_CONFIG.plans.free[limitType];
    
    // Override with endpoint-specific limits if they exist
    const endpointOverride = RATE_LIMIT_CONFIG.endpoints[endpoint];
    
    return {
      ...baseConfig,
      ...planLimits,
      ...endpointOverride
    };
  }

  // Check burst protection (short-term high frequency)
  async checkBurstLimit(key, now) {
    const burstConfig = RATE_LIMIT_CONFIG.burst;
    const windowStart = now - burstConfig.windowMs;
    
    if (redisService.isConnected) {
      // Use Redis for burst protection
      const pipeline = redisService.client.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zadd(key, now, now);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(burstConfig.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[2][1];
      
      return {
        allowed: count <= burstConfig.max,
        limit: burstConfig.max,
        remaining: Math.max(0, burstConfig.max - count),
        resetTime: now + burstConfig.windowMs,
        retryAfter: count > burstConfig.max ? 1 : 0,
        type: 'burst'
      };
    } else {
      // Memory fallback for burst protection
      const record = this.memoryStore.get(key) || { requests: [], resetTime: now + burstConfig.windowMs };
      
      // Remove old requests
      record.requests = record.requests.filter(time => time > windowStart);
      record.requests.push(now);
      
      this.memoryStore.set(key, record);
      
      return {
        allowed: record.requests.length <= burstConfig.max,
        limit: burstConfig.max,
        remaining: Math.max(0, burstConfig.max - record.requests.length),
        resetTime: record.resetTime,
        retryAfter: record.requests.length > burstConfig.max ? 1 : 0,
        type: 'burst'
      };
    }
  }

  // Check main rate limit
  async checkMainLimit(key, limits, now) {
    const windowStart = now - limits.windowMs;
    
    if (redisService.isConnected) {
      // Use Redis sliding window
      const pipeline = redisService.client.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(limits.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[2][1];
      
      return {
        allowed: count <= limits.max,
        limit: limits.max,
        remaining: Math.max(0, limits.max - count),
        resetTime: now + limits.windowMs,
        retryAfter: count > limits.max ? Math.ceil(limits.windowMs / 1000) : 0,
        type: 'main'
      };
    } else {
      // Memory fallback
      const record = this.memoryStore.get(key) || { 
        requests: [], 
        resetTime: now + limits.windowMs 
      };
      
      // Sliding window cleanup
      record.requests = record.requests.filter(time => time > windowStart);
      record.requests.push(now);
      
      this.memoryStore.set(key, record);
      
      return {
        allowed: record.requests.length <= limits.max,
        limit: limits.max,
        remaining: Math.max(0, limits.max - record.requests.length),
        resetTime: record.resetTime,
        retryAfter: record.requests.length > limits.max ? Math.ceil(limits.windowMs / 1000) : 0,
        type: 'main'
      };
    }
  }

  // Check endpoint-specific limits
  async checkEndpointLimit(req, key, now) {
    const endpoint = this.getEndpointKey(req);
    const endpointConfig = RATE_LIMIT_CONFIG.endpoints[endpoint];
    
    if (!endpointConfig) {
      return { allowed: true, type: 'endpoint' };
    }
    
    return this.checkMainLimit(key, endpointConfig, now);
  }

  // Set rate limit headers
  setRateLimitHeaders(res, result) {
    res.set({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });
    
    if (result.retryAfter > 0) {
      res.set('Retry-After', result.retryAfter.toString());
    }
  }

  // Send rate limit error response
  sendRateLimitError(res, result) {
    const message = this.getRateLimitMessage(result);
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message,
      limit: result.limit,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
      retryAfter: result.retryAfter,
      type: result.type
    });
  }

  // Get user-friendly rate limit message
  getRateLimitMessage(result) {
    const resetDate = new Date(result.resetTime);
    const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000);
    
    switch (result.type) {
      case 'burst':
        return 'Too many requests in a short time. Please wait a moment and try again.';
      case 'main':
        return `Rate limit exceeded. Limit resets in ${resetIn} seconds (${resetDate.toLocaleTimeString()}).`;
      case 'endpoint':
        return 'Endpoint-specific rate limit exceeded. Please try again later.';
      default:
        return 'Rate limit exceeded. Please try again later.';
    }
  }

  // Create plan-aware limiter
  createPlanLimiter(limitType = 'api') {
    return this.createLimiter({
      keyGenerator: (req) => {
        const user = req.user;
        const plan = user?.plan || 'free';
        const userId = user?.id || this.getClientIP(req);
        return `${limitType}:${plan}:${userId}`;
      },
      max: (req) => {
        const plan = req.user?.plan || 'free';
        return RATE_LIMIT_CONFIG.plans[plan][limitType]?.max || RATE_LIMIT_CONFIG.plans.free[limitType].max;
      },
      windowMs: (req) => {
        const plan = req.user?.plan || 'free';
        return RATE_LIMIT_CONFIG.plans[plan][limitType]?.windowMs || RATE_LIMIT_CONFIG.plans.free[limitType].windowMs;
      }
    });
  }

  // Whitelist management
  async addToWhitelist(identifier, type = 'ip') {
    const key = `whitelist:${type}:${identifier}`;
    
    if (redisService.isConnected) {
      await redisService.set(key, 'true', 24 * 60 * 60); // 24 hours
    } else {
      this.memoryStore.set(key, { whitelisted: true, expires: Date.now() + 24 * 60 * 60 * 1000 });
    }
  }

  async removeFromWhitelist(identifier, type = 'ip') {
    const key = `whitelist:${type}:${identifier}`;
    
    if (redisService.isConnected) {
      await redisService.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  async isWhitelisted(identifier, type = 'ip') {
    const key = `whitelist:${type}:${identifier}`;
    
    if (redisService.isConnected) {
      const result = await redisService.get(key);
      return result === 'true';
    } else {
      const record = this.memoryStore.get(key);
      return record && (!record.expires || record.expires > Date.now());
    }
  }

  // Analytics and monitoring
  async getRateLimitStats(timeframe = '1h') {
    // This would integrate with your metrics system
    return {
      requests: {
        total: 0,
        blocked: 0,
        allowed: 0
      },
      topBlockedIPs: [],
      topBlockedUsers: [],
      byPlan: {
        free: { requests: 0, blocked: 0 },
        pro: { requests: 0, blocked: 0 },
        enterprise: { requests: 0, blocked: 0 }
      }
    };
  }

  // Memory cleanup for fallback mode
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [key, record] of this.memoryStore.entries()) {
        if (record.resetTime && record.resetTime < now) {
          this.memoryStore.delete(key);
        } else if (record.expires && record.expires < now) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  // Graceful shutdown
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create singleton instance
export const rateLimiter = new AdvancedRateLimiter();

// Export convenience methods
export const {
  createLimiter,
  createPlanLimiter,
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted,
  getRateLimitStats
} = rateLimiter;

// Pre-configured limiters
export const limiters = {
  general: rateLimiter.createLimiter(),
  auth: rateLimiter.createLimiter(RATE_LIMIT_CONFIG.endpoints['/api/auth/login']),
  api: rateLimiter.createPlanLimiter('api'),
  ai: rateLimiter.createPlanLimiter('ai'),
  optimize: rateLimiter.createPlanLimiter('optimize'),
  email: rateLimiter.createPlanLimiter('email'),
  upload: rateLimiter.createPlanLimiter('upload')
};

export default rateLimiter;