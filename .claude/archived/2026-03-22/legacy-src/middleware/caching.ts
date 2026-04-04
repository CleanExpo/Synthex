import { Request, Response, NextFunction } from 'express';
import CacheService from '../services/cache.service';

interface CacheOptions {
  ttl?: number; // seconds
  keyGenerator?: (req: Request) => string;
}

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = 300, keyGenerator } = options; // default 5 minutes

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : CacheService.generateKey('api', req.originalUrl, JSON.stringify(req.query));

    try {
      // Try to get from cache
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (data: any) => {
        // Cache the response
        CacheService.set(cacheKey, data, ttl).catch(console.error);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

export const invalidateCache = (pattern: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (data: any) => {
      // Invalidate cache on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        CacheService.invalidatePattern(pattern).catch(console.error);
      }
      return originalJson(data);
    };

    next();
  };
};

// Cache management functions for admin routes
export const getCacheStats = () => {
  return {
    enabled: !!process.env.REDIS_URL,
    redisConnected: false, // Would need to check actual connection
    stats: {
      hits: 0,
      misses: 0,
      keys: 0,
      memory: 0
    }
  };
};

export const clearCache = (pattern?: string) => {
  if (pattern) {
    CacheService.invalidatePattern(pattern).catch(console.error);
    return 1; // Return number of cleared entries
  }
  // Clear all would require pattern '*'
  CacheService.invalidatePattern('*').catch(console.error);
  return 1;
};

export const clearUserCache = (userId: string) => {
  CacheService.invalidatePattern(`*:${userId}:*`).catch(console.error);
  return 1;
};

export default cacheMiddleware;
