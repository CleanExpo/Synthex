/**
 * API Response Caching Layer
 * Easy-to-use caching for Next.js API routes
 *
 * @task UNI-435 - Scalability & Performance Epic
 *
 * Usage:
 * ```typescript
 * // Simple caching
 * export async function GET(request: NextRequest) {
 *   return withCache('quotes:list', { ttl: 300 }, async () => {
 *     const quotes = await prisma.quote.findMany();
 *     return NextResponse.json({ quotes });
 *   });
 * }
 *
 * // With cache tags for invalidation
 * export async function GET(request: NextRequest, { params }) {
 *   return withCache(
 *     `quote:${params.id}`,
 *     { ttl: 600, tags: ['quotes', `quote:${params.id}`] },
 *     async () => {
 *       const quote = await prisma.quote.findUnique({ where: { id: params.id } });
 *       return NextResponse.json({ quote });
 *     }
 *   );
 * }
 *
 * // Invalidate cache
 * await invalidateCache('quotes'); // Invalidates all quote-related caches
 * ```
 */

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Cache storage interface
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
}

// In-memory fallback cache
const memoryCache = new Map<string, CacheEntry>();
const tagIndex = new Map<string, Set<string>>(); // tag -> cache keys

// Redis client (optional - for distributed caching)
let redis: Redis | null = null;

// Initialize Redis if available
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.warn('[API Cache] Redis not available, using in-memory cache');
}

export interface CacheOptions {
  /** Time to live in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Cache tags for targeted invalidation */
  tags?: string[];
  /** Skip cache and always fetch fresh data */
  skipCache?: boolean;
  /** Stale-while-revalidate: serve stale data while fetching fresh */
  staleWhileRevalidate?: number;
}

/**
 * Wrap an API handler with caching
 */
export async function withCache<T>(
  cacheKey: string,
  options: CacheOptions,
  handler: () => Promise<T>
): Promise<T> {
  const { ttl = 300, tags = [], skipCache = false, staleWhileRevalidate } = options;

  // Skip cache if requested
  if (skipCache) {
    return handler();
  }

  const fullKey = `api:${cacheKey}`;

  // Try to get from cache
  const cached = await getFromCache(fullKey);

  if (cached) {
    const age = (Date.now() - cached.timestamp) / 1000;

    // If within TTL, return cached data
    if (age < cached.ttl) {
      // Add cache headers to response if it's a NextResponse
      if (cached.data instanceof NextResponse) {
        cached.data.headers.set('X-Cache', 'HIT');
        cached.data.headers.set('X-Cache-Age', Math.floor(age).toString());
      }
      return cached.data;
    }

    // If within stale-while-revalidate window, return stale and refresh in background
    if (staleWhileRevalidate && age < cached.ttl + staleWhileRevalidate) {
      // Refresh in background (don't await)
      refreshCache(fullKey, ttl, tags, handler).catch((err) => {
        console.error('[API Cache] Background refresh failed:', err);
      });

      if (cached.data instanceof NextResponse) {
        cached.data.headers.set('X-Cache', 'STALE');
        cached.data.headers.set('X-Cache-Age', Math.floor(age).toString());
      }
      return cached.data;
    }
  }

  // Cache miss - fetch fresh data
  const result = await handler();

  // Store in cache
  await setInCache(fullKey, result, ttl, tags);

  // Add cache headers
  if (result instanceof NextResponse) {
    result.headers.set('X-Cache', 'MISS');
    result.headers.set('X-Cache-TTL', ttl.toString());
  }

  return result;
}

/**
 * Get value from cache
 */
async function getFromCache(key: string): Promise<CacheEntry | null> {
  try {
    // Try Redis first
    if (redis) {
      const cached = await redis.get<CacheEntry>(key);
      if (cached) {
        return cached;
      }
    }

    // Fall back to memory cache
    const entry = memoryCache.get(key);
    if (entry) {
      return entry;
    }

    return null;
  } catch (error) {
    console.error('[API Cache] Get error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
async function setInCache(key: string, data: any, ttl: number, tags: string[]): Promise<void> {
  try {
    const entry: CacheEntry = {
      data: data instanceof NextResponse ? await serializeResponse(data) : data,
      timestamp: Date.now(),
      ttl,
      tags,
    };

    // Store in Redis if available
    if (redis) {
      // Store with extra TTL for stale-while-revalidate support
      await redis.setex(key, ttl * 2, entry);

      // Update tag index
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        await redis.sadd(tagKey, key);
        await redis.expire(tagKey, ttl * 2);
      }
    }

    // Also store in memory cache (for fast local access)
    memoryCache.set(key, entry);

    // Update local tag index
    for (const tag of tags) {
      if (!tagIndex.has(tag)) {
        tagIndex.set(tag, new Set());
      }
      tagIndex.get(tag)!.add(key);
    }

    // Clean up old entries periodically
    if (memoryCache.size > 1000) {
      cleanupMemoryCache();
    }
  } catch (error) {
    console.error('[API Cache] Set error:', error);
  }
}

/**
 * Refresh cache in background
 */
async function refreshCache<T>(
  key: string,
  ttl: number,
  tags: string[],
  handler: () => Promise<T>
): Promise<void> {
  const result = await handler();
  await setInCache(key, result, ttl, tags);
}

/**
 * Invalidate cache by tag
 */
export async function invalidateCache(tag: string): Promise<number> {
  let count = 0;

  try {
    // Invalidate in Redis
    if (redis) {
      const tagKey = `tag:${tag}`;
      const keys = await redis.smembers<string[]>(tagKey);

      if (keys && keys.length > 0) {
        await redis.del(...keys);
        await redis.del(tagKey);
        count = keys.length;
      }
    }

    // Invalidate in memory cache
    const localKeys = tagIndex.get(tag);
    if (localKeys) {
      for (const key of localKeys) {
        memoryCache.delete(key);
      }
      count = Math.max(count, localKeys.size);
      tagIndex.delete(tag);
    }

    console.log(`[API Cache] Invalidated ${count} entries for tag: ${tag}`);
    return count;
  } catch (error) {
    console.error('[API Cache] Invalidation error:', error);
    return 0;
  }
}

/**
 * Invalidate specific cache key
 */
export async function invalidateCacheKey(cacheKey: string): Promise<boolean> {
  const fullKey = `api:${cacheKey}`;

  try {
    if (redis) {
      await redis.del(fullKey);
    }
    memoryCache.delete(fullKey);
    return true;
  } catch (error) {
    console.error('[API Cache] Key invalidation error:', error);
    return false;
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    // Note: Only clears keys with our prefix in Redis
    if (redis) {
      const keys = await redis.keys('api:*');
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
      const tagKeys = await redis.keys('tag:*');
      if (tagKeys && tagKeys.length > 0) {
        await redis.del(...tagKeys);
      }
    }

    memoryCache.clear();
    tagIndex.clear();

    console.log('[API Cache] All cache cleared');
  } catch (error) {
    console.error('[API Cache] Clear all error:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  memoryCacheSize: number;
  redisAvailable: boolean;
  tags: string[];
}> {
  return {
    memoryCacheSize: memoryCache.size,
    redisAvailable: redis !== null,
    tags: Array.from(tagIndex.keys()),
  };
}

/**
 * Clean up expired entries from memory cache
 */
function cleanupMemoryCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryCache.entries()) {
    const age = (now - entry.timestamp) / 1000;
    if (age > entry.ttl * 2) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[API Cache] Cleaned up ${cleaned} expired entries`);
  }
}

/**
 * Serialize NextResponse for caching
 */
async function serializeResponse(response: NextResponse): Promise<any> {
  const body = await response.clone().text();
  return {
    __isNextResponse: true,
    body,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

/**
 * Cache decorator for class methods
 */
export function Cached(keyPrefix: string, options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${keyPrefix}:${propertyKey}:${JSON.stringify(args)}`;
      return withCache(cacheKey, options, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

export default withCache;
