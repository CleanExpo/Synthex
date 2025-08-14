/**
 * Cache Middleware for Next.js API Routes
 * Provides automatic caching for API responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheFactory } from '../infrastructure/caching/cache.factory';
import { ConsoleLogger } from '../infrastructure/logging/console-logger';
import crypto from 'crypto';

// Initialize cache service
const logger = new ConsoleLogger();
const cache = CacheFactory.createCacheService(logger);

export interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  key?: string;           // Custom cache key
  excludeQuery?: string[]; // Query params to exclude from cache key
  varyBy?: string[];      // Headers to vary cache by
  revalidate?: boolean;   // Force cache revalidation
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: NextRequest, options: CacheOptions = {}): string {
  const url = new URL(req.url);
  
  // Start with pathname
  let keyParts = [url.pathname];
  
  // Add query parameters (excluding specified ones)
  const queryParams = new URLSearchParams(url.search);
  const excludeQuery = options.excludeQuery || [];
  
  const relevantParams: string[] = [];
  queryParams.forEach((value, key) => {
    if (!excludeQuery.includes(key)) {
      relevantParams.push(`${key}=${value}`);
    }
  });
  
  if (relevantParams.length > 0) {
    keyParts.push(relevantParams.sort().join('&'));
  }
  
  // Add vary-by headers
  if (options.varyBy && options.varyBy.length > 0) {
    const headerValues = options.varyBy.map(header => 
      `${header}:${req.headers.get(header) || ''}`
    );
    keyParts.push(headerValues.join('|'));
  }
  
  // Generate hash for long keys
  const fullKey = keyParts.join(':');
  if (fullKey.length > 200) {
    const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
    return `api:${url.pathname}:${hash}`;
  }
  
  return `api:${fullKey}`;
}

/**
 * Cache middleware for API routes
 */
export function withCache(options: CacheOptions = {}) {
  return async function cacheMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return handler(req);
    }
    
    // Check for revalidation header
    const shouldRevalidate = options.revalidate || 
      req.headers.get('x-revalidate') === 'true' ||
      req.headers.get('cache-control') === 'no-cache';
    
    const cacheKey = options.key || generateCacheKey(req, options);
    const ttl = options.ttl || 300; // Default 5 minutes
    
    // Try to get from cache if not revalidating
    if (!shouldRevalidate) {
      try {
        const cached = await cache.get<{
          body: any;
          headers: Record<string, string>;
          status: number;
        }>(cacheKey);
        
        if (cached) {
          logger.debug(`Cache hit: ${cacheKey}`);
          
          // Create response from cached data
          const response = NextResponse.json(cached.body, {
            status: cached.status,
            headers: cached.headers
          });
          
          // Add cache headers
          response.headers.set('X-Cache', 'HIT');
          response.headers.set('X-Cache-Key', cacheKey);
          response.headers.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
          
          return response;
        }
      } catch (error) {
        logger.error('Cache get error', error as Error);
        // Continue to handler on cache error
      }
    }
    
    // Execute handler
    const response = await handler(req);
    
    // Only cache successful responses
    if (response.status >= 200 && response.status < 300) {
      try {
        // Parse response body
        const body = await response.json();
        
        // Store in cache
        await cache.set(cacheKey, {
          body,
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status
        }, ttl);
        
        logger.debug(`Cache set: ${cacheKey}, TTL: ${ttl}s`);
        
        // Create new response with cache headers
        const cachedResponse = NextResponse.json(body, {
          status: response.status,
          headers: response.headers
        });
        
        cachedResponse.headers.set('X-Cache', 'MISS');
        cachedResponse.headers.set('X-Cache-Key', cacheKey);
        cachedResponse.headers.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        
        return cachedResponse;
        
      } catch (error) {
        logger.error('Cache set error', error as Error);
        // Return original response on cache error
        return response;
      }
    }
    
    // Don't cache error responses
    response.headers.set('X-Cache', 'BYPASS');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return response;
  };
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const deleted = await cache.deletePattern(`api:${pattern}`);
    logger.info(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
    return deleted;
  } catch (error) {
    logger.error('Cache invalidation error', error as Error);
    return 0;
  }
}

/**
 * Clear all API cache
 */
export async function clearApiCache(): Promise<void> {
  try {
    await cache.deletePattern('api:*');
    logger.info('Cleared all API cache');
  } catch (error) {
    logger.error('Cache clear error', error as Error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  return cache.getStats();
}

/**
 * Cached API route wrapper (simplified)
 */
export function cachedRoute(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: CacheOptions = {}
) {
  return async (req: NextRequest) => {
    const middleware = withCache(options);
    return middleware(req, handler);
  };
}