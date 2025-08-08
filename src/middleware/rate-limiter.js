/**
 * Rate Limiting Middleware
 * Implements different rate limiting strategies for various endpoints
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../../config/app.config');

// Create Redis client for rate limiting
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: `${config.redis.keyPrefix}ratelimit:`
});

// Helper to create rate limiter with Redis store
const createRateLimiter = (options) => {
  const defaultOptions = {
    store: new RedisStore({
      client: redisClient,
      prefix: options.prefix || 'rl:',
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Too many requests, please try again later',
        retryAfter: res.getHeader('Retry-After')
      });
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user && req.user.role === 'admin';
    }
  };

  return rateLimit({
    ...defaultOptions,
    ...options
  });
};

// Standard rate limiter - 100 requests per 15 minutes
const standard = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  prefix: 'standard:'
});

// Strict rate limiter - 20 requests per 15 minutes
const strict = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Rate limit exceeded for this operation',
  prefix: 'strict:'
});

// AI rate limiter - 30 requests per hour
const ai = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'AI generation limit reached, please try again later',
  prefix: 'ai:',
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP for AI requests
    return req.user ? req.user.id : req.ip;
  }
});

// High traffic rate limiter - 1000 requests per 15 minutes
const high = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'High traffic limit exceeded',
  prefix: 'high:'
});

// Auth rate limiter - 5 attempts per 15 minutes
const auth = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later',
  prefix: 'auth:',
  skipSuccessfulRequests: true
});

// Upload rate limiter - 10 uploads per hour
const upload = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Upload limit reached, please try again later',
  prefix: 'upload:',
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

// Download rate limiter - 50 downloads per hour
const download = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Download limit reached, please try again later',
  prefix: 'download:',
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

// Webhook rate limiter - 1000 requests per minute
const webhook = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'Webhook rate limit exceeded',
  prefix: 'webhook:',
  skip: (req) => {
    // Skip rate limiting for verified webhook sources
    const trustedSources = ['stripe', 'github', 'slack'];
    const source = req.headers['x-webhook-source'];
    return trustedSources.includes(source);
  }
});

// Sync rate limiter - 100 sync operations per hour
const sync = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Sync rate limit exceeded',
  prefix: 'sync:',
  keyGenerator: (req) => {
    // Rate limit by device ID for sync operations
    return req.device ? req.device.id : req.ip;
  }
});

// Dynamic rate limiter based on user tier
const dynamic = (req, res, next) => {
  const userTier = req.user?.tier || 'free';
  
  const tierLimits = {
    free: { windowMs: 15 * 60 * 1000, max: 50 },
    basic: { windowMs: 15 * 60 * 1000, max: 200 },
    pro: { windowMs: 15 * 60 * 1000, max: 500 },
    enterprise: { windowMs: 15 * 60 * 1000, max: 2000 }
  };

  const limits = tierLimits[userTier] || tierLimits.free;
  
  const limiter = createRateLimiter({
    ...limits,
    message: `Rate limit exceeded for ${userTier} tier`,
    prefix: `dynamic:${userTier}:`,
    keyGenerator: (req) => {
      return req.user ? req.user.id : req.ip;
    }
  });

  limiter(req, res, next);
};

// Per-platform rate limiter
const platform = (platformName) => {
  const platformLimits = {
    tiktok: { windowMs: 60 * 1000, max: 60 },
    instagram: { windowMs: 60 * 1000, max: 200 },
    facebook: { windowMs: 60 * 1000, max: 200 },
    twitter: { windowMs: 15 * 60 * 1000, max: 300 },
    linkedin: { windowMs: 15 * 60 * 1000, max: 100 },
    youtube: { windowMs: 60 * 1000, max: 100 }
  };

  const limits = platformLimits[platformName] || { windowMs: 60 * 1000, max: 100 };

  return createRateLimiter({
    ...limits,
    message: `Rate limit exceeded for ${platformName} API`,
    prefix: `platform:${platformName}:`,
    keyGenerator: (req) => {
      return req.user ? req.user.id : req.ip;
    }
  });
};

// Custom rate limiter factory
const custom = (options) => createRateLimiter(options);

// Reset rate limit for a specific key
const resetLimit = async (key, prefix = 'standard:') => {
  try {
    const fullKey = `${config.redis.keyPrefix}ratelimit:${prefix}${key}`;
    await redisClient.del(fullKey);
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
};

// Get remaining limit for a key
const getRemainingLimit = async (key, prefix = 'standard:') => {
  try {
    const fullKey = `${config.redis.keyPrefix}ratelimit:${prefix}${key}`;
    const count = await redisClient.get(fullKey);
    return count ? parseInt(count) : null;
  } catch (error) {
    console.error('Error getting remaining limit:', error);
    return null;
  }
};

// Middleware to add rate limit info to response headers
const addRateLimitHeaders = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.getHeader('X-RateLimit-Limit')) {
      const limit = res.getHeader('X-RateLimit-Limit');
      const remaining = res.getHeader('X-RateLimit-Remaining');
      const reset = res.getHeader('X-RateLimit-Reset');
      
      res.setHeader('X-Rate-Limit-Info', JSON.stringify({
        limit,
        remaining,
        reset: new Date(parseInt(reset) * 1000).toISOString()
      }));
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  standard,
  strict,
  ai,
  high,
  auth,
  upload,
  download,
  webhook,
  sync,
  dynamic,
  platform,
  custom,
  resetLimit,
  getRemainingLimit,
  addRateLimitHeaders
};