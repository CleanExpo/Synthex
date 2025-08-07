import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// In-memory cache for development - in production, use Redis
const cache = new Map<string, { data: any; expiry: number; etag: string }>();

// Cache configuration
interface CacheOptions {
  ttl: number; // Time to live in seconds
  keyPrefix?: string;
  skipIf?: (req: Request) => boolean;
  varyBy?: string[];
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix: string = '', varyBy: string[] = []): string {
  const baseKey = `${prefix}:${req.method}:${req.originalUrl}`;
  
  if (varyBy.length === 0) {
    return baseKey;
  }
  
  // Add vary parameters to key
  const varyParts = varyBy.map(param => {
    if (param.startsWith('header:')) {
      const headerName = param.replace('header:', '');
      return `${headerName}=${req.get(headerName) || 'none'}`;
    }
    if (param.startsWith('query:')) {
      const queryParam = param.replace('query:', '');
      return `${queryParam}=${req.query[queryParam] || 'none'}`;
    }
    if (param === 'user') {
      return `user=${req.user?.id || 'anonymous'}`;
    }
    return `${param}=${(req as any)[param] || 'none'}`;
  }).join('&');
  
  return `${baseKey}?${varyParts}`;
}

/**
 * Generate ETag for response data
 */
function generateETag(data: any): string {
  const hash = createHash('md5');
  hash.update(JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Cache middleware for API responses
 */
export function cacheMiddleware(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition is met
    if (options.skipIf && options.skipIf(req)) {
      return next();
    }
    
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = generateCacheKey(req, options.keyPrefix, options.varyBy);
    const cached = cache.get(cacheKey);
    
    // Check if cached data exists and is not expired
    if (cached && cached.expiry > Date.now()) {
      // Check if client has cached version (ETag)
      const clientETag = req.get('If-None-Match');
      if (clientETag && clientETag === cached.etag) {
        return res.status(304).end();
      }
      
      // Return cached data
      res.set('Cache-Control', `public, max-age=${options.ttl}`);
      res.set('ETag', cached.etag);
      res.set('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache response
    res.json = function(data: any) {
      // Generate ETag
      const etag = generateETag(data);
      
      // Cache the response
      cache.set(cacheKey, {
        data,
        expiry: Date.now() + (options.ttl * 1000),
        etag
      });
      
      // Set cache headers
      res.set('Cache-Control', `public, max-age=${options.ttl}`);
      res.set('ETag', etag);
      res.set('X-Cache', 'MISS');
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Predefined cache configurations for common use cases
 */
export const CacheProfiles = {
  // Short cache for dynamic data that changes frequently
  short: { ttl: 60 }, // 1 minute
  
  // Medium cache for semi-static data
  medium: { ttl: 300 }, // 5 minutes
  
  // Long cache for static data
  long: { ttl: 3600 }, // 1 hour
  
  // User-specific cache
  userSpecific: {
    ttl: 300,
    keyPrefix: 'user',
    varyBy: ['user']
  },
  
  // Analytics cache (varies by date range and user)
  analytics: {
    ttl: 600, // 10 minutes
    keyPrefix: 'analytics',
    varyBy: ['user', 'query:startDate', 'query:endDate', 'query:platform']
  },
  
  // Content cache (public data)
  content: {
    ttl: 1800, // 30 minutes
    keyPrefix: 'content'
  },
  
  // API status and health checks
  status: {
    ttl: 30, // 30 seconds
    keyPrefix: 'status'
  }
};

/**
 * Clear cache by pattern
 */
export function clearCache(pattern: string = ''): number {
  if (!pattern) {
    const size = cache.size;
    cache.clear();
    return size;
  }
  
  let cleared = 0;
  for (const [key] of cache) {
    if (key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    }
  }
  return cleared;
}

/**
 * Clear user-specific cache
 */
export function clearUserCache(userId: string): number {
  return clearCache(`user=${userId}`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let expired = 0;
  let active = 0;
  
  for (const [, value] of cache) {
    if (value.expiry <= now) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: cache.size,
    active,
    expired,
    hitRatio: 0, // Would need to track hits/misses for this
    memory: JSON.stringify(Array.from(cache.entries())).length
  };
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache) {
    if (value.expiry <= now) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Conditional caching based on request properties
 */
export const conditionalCache = {
  // Skip caching for authenticated admin requests
  skipAdmin: (req: Request) => {
    const user = req.user as any;
    return user?.role === 'admin' || user?.role === 'superadmin';
  },
  
  // Skip caching if there are query parameters (dynamic requests)
  skipWithParams: (req: Request) => {
    return Object.keys(req.query).length > 0;
  },
  
  // Skip caching for development environment
  skipInDev: (req: Request) => {
    return process.env.NODE_ENV === 'development';
  },
  
  // Skip caching for errors
  skipErrors: (req: Request) => {
    return false; // Will be set by error handling middleware
  }
};

// Automatically clean expired cache every 5 minutes
setInterval(() => {
  const cleaned = cleanExpiredCache();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned ${cleaned} expired cache entries`);
  }
}, 5 * 60 * 1000);

export default cacheMiddleware;
