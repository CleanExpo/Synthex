/**
 * Redis Cache Middleware
 *
 * Provides caching for API routes with Redis backend and memory fallback.
 * Supports TTL, cache keys, and automatic invalidation.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UPSTASH_REDIS_REST_URL (INTERNAL)
 * - UPSTASH_REDIS_REST_TOKEN (SECRET)
 *
 * @module middleware/cache
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Types
// =============================================================================

export interface CacheConfig {
  /** Time to live in seconds */
  ttl: number;
  /** Custom cache key generator */
  keyGenerator?: (req: NextRequest) => string;
  /** Skip cache for certain requests */
  skip?: (req: NextRequest) => boolean;
  /** Stale-while-revalidate time in seconds */
  staleWhileRevalidate?: number;
  /** Tags for cache invalidation */
  tags?: string[];
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

// =============================================================================
// Memory Cache (Fallback)
// =============================================================================

const memoryCache = new Map<string, CacheEntry>();
const MAX_MEMORY_ENTRIES = 1000;

function cleanMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.timestamp + entry.ttl * 1000) {
      memoryCache.delete(key);
    }
  }

  // Evict oldest entries if over limit
  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const entries = Array.from(memoryCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toDelete = entries.slice(0, entries.length - MAX_MEMORY_ENTRIES);
    toDelete.forEach(([key]) => memoryCache.delete(key));
  }
}

// =============================================================================
// Redis Client
// =============================================================================

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
  del: (key: string | string[]) => Promise<void>;
  keys: (pattern: string) => Promise<string[]>;
}

let redisClient: RedisClient | null = null;

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return null;
  }

  redisClient = {
    async get(key: string) {
      try {
        const res = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${upstashToken}` },
        });
        const data = await res.json();
        return data.result;
      } catch {
        return null;
      }
    },
    async set(key: string, value: string, options?: { EX?: number }) {
      try {
        let url = `${upstashUrl}/set/${encodeURIComponent(key)}`;
        if (options?.EX) {
          url += `/ex/${options.EX}`;
        }
        await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${upstashToken}`,
            'Content-Type': 'application/json',
          },
          body: value,
        });
      } catch (error) {
        console.error('Redis set error:', error);
      }
    },
    async del(keys: string | string[]) {
      try {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        await Promise.all(
          keyArray.map((key) =>
            fetch(`${upstashUrl}/del/${encodeURIComponent(key)}`, {
              headers: { Authorization: `Bearer ${upstashToken}` },
            })
          )
        );
      } catch (error) {
        console.error('Redis del error:', error);
      }
    },
    async keys(pattern: string) {
      try {
        const res = await fetch(`${upstashUrl}/keys/${encodeURIComponent(pattern)}`, {
          headers: { Authorization: `Bearer ${upstashToken}` },
        });
        const data = await res.json();
        return data.result || [];
      } catch {
        return [];
      }
    },
  };

  return redisClient;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get cached value
 */
async function getCached(key: string): Promise<CacheEntry | null> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const value = await redis.get(`cache:${key}`);
      if (value) {
        return JSON.parse(value);
      }
    } catch {
      // Fall through to memory cache
    }
  }

  // Memory fallback
  const entry = memoryCache.get(key);
  if (entry && Date.now() < entry.timestamp + entry.ttl * 1000) {
    return entry;
  }

  return null;
}

/**
 * Set cached value
 */
async function setCached(
  key: string,
  data: any,
  ttl: number,
  tags?: string[]
): Promise<void> {
  const entry: CacheEntry = {
    data,
    timestamp: Date.now(),
    ttl,
    tags,
  };

  const redis = await getRedisClient();

  if (redis) {
    try {
      await redis.set(`cache:${key}`, JSON.stringify(entry), { EX: ttl });

      // Store tag associations for invalidation
      if (tags) {
        for (const tag of tags) {
          await redis.set(`tag:${tag}:${key}`, '1', { EX: ttl });
        }
      }
    } catch {
      // Fall through to memory cache
    }
  }

  // Also store in memory for fast access
  memoryCache.set(key, entry);

  // Periodic cleanup
  if (Math.random() < 0.01) {
    cleanMemoryCache();
  }
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  memoryCache.delete(key);

  const redis = await getRedisClient();
  if (redis) {
    await redis.del(`cache:${key}`);
  }
}

/**
 * Invalidate cache by tag
 */
export async function invalidateCacheByTag(tag: string): Promise<void> {
  const redis = await getRedisClient();

  if (redis) {
    const keys = await redis.keys(`tag:${tag}:*`);
    const cacheKeys = keys.map((k) => `cache:${k.replace(`tag:${tag}:`, '')}`);
    if (cacheKeys.length > 0) {
      await redis.del([...keys, ...cacheKeys]);
    }
  }

  // Clear memory cache entries with this tag
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.tags?.includes(tag)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  memoryCache.clear();

  const redis = await getRedisClient();
  if (redis) {
    const keys = await redis.keys('cache:*');
    const tagKeys = await redis.keys('tag:*');
    if (keys.length > 0 || tagKeys.length > 0) {
      await redis.del([...keys, ...tagKeys]);
    }
  }
}

// =============================================================================
// Cache Middleware
// =============================================================================

/**
 * Default cache key generator
 */
function defaultKeyGenerator(req: NextRequest): string {
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  return `${req.method}:${url.pathname}${params ? `?${params}` : ''}`;
}

/**
 * Create cache middleware
 */
export function createCacheMiddleware(config: CacheConfig) {
  const {
    ttl,
    keyGenerator = defaultKeyGenerator,
    skip,
    staleWhileRevalidate = 0,
    tags = [],
  } = config;

  return async function cacheMiddleware(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return handler();
    }

    // Check skip condition
    if (skip && skip(req)) {
      return handler();
    }

    const cacheKey = keyGenerator(req);

    // Try to get from cache
    const cached = await getCached(cacheKey);

    if (cached) {
      const age = Math.floor((Date.now() - cached.timestamp) / 1000);
      const isStale = age > ttl;
      const isWithinStaleWindow = staleWhileRevalidate > 0 && age <= ttl + staleWhileRevalidate;

      // Return cached response
      if (!isStale || isWithinStaleWindow) {
        const response = NextResponse.json(cached.data);
        response.headers.set('X-Cache', isStale ? 'STALE' : 'HIT');
        response.headers.set('X-Cache-Age', age.toString());
        response.headers.set('Cache-Control', `max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`);

        // Revalidate in background if stale
        if (isStale && isWithinStaleWindow) {
          // Background cache refresh - don't block response
          handler().then(async (freshResponse) => {
            if (freshResponse.ok) {
              const data = await freshResponse.json();
              await setCached(cacheKey, data, ttl, tags);
            }
          }).catch(() => { /* Cache refresh failed silently */ });
        }

        return response;
      }
    }

    // Execute handler and cache response
    const response = await handler();

    if (response.ok) {
      try {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        await setCached(cacheKey, data, ttl, tags);

        // Add cache headers
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('Cache-Control', `max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`);
      } catch {
        // Response not JSON, skip caching
      }
    }

    return response;
  };
}

// =============================================================================
// Pre-configured Cache Middlewares
// =============================================================================

export const cacheConfigs = {
  /** User profiles - 5 min TTL */
  userProfile: {
    ttl: 5 * 60,
    staleWhileRevalidate: 60,
    tags: ['user'],
  },

  /** Analytics aggregations - 1 min TTL */
  analytics: {
    ttl: 60,
    staleWhileRevalidate: 30,
    tags: ['analytics'],
  },

  /** Platform configurations - 15 min TTL */
  platformConfig: {
    ttl: 15 * 60,
    staleWhileRevalidate: 5 * 60,
    tags: ['config'],
  },

  /** AI generated content - 24h TTL */
  aiContent: {
    ttl: 24 * 60 * 60,
    staleWhileRevalidate: 60 * 60,
    tags: ['ai', 'content'],
  },

  /** Static data - 1 hour TTL */
  static: {
    ttl: 60 * 60,
    staleWhileRevalidate: 5 * 60,
    tags: ['static'],
  },
};

/**
 * Apply caching to an API route handler
 *
 * @example
 * ```ts
 * import { withCache, cacheConfigs } from '@/middleware/cache';
 *
 * export const GET = withCache(
 *   cacheConfigs.analytics,
 *   async (request) => {
 *     const data = await fetchAnalytics();
 *     return NextResponse.json(data);
 *   }
 * );
 * ```
 */
export function withCache(
  config: CacheConfig,
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  const middleware = createCacheMiddleware(config);

  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    return middleware(req, () => handler(req, context));
  };
}

// =============================================================================
// Cache Warming
// =============================================================================

/**
 * Warm cache for popular routes
 */
export async function warmCache(routes: string[]): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  await Promise.all(
    routes.map(async (route) => {
      try {
        await fetch(`${baseUrl}${route}`, {
          method: 'GET',
          headers: { 'X-Cache-Warm': 'true' },
        });
      } catch (error) {
        console.warn(`Failed to warm cache for ${route}:`, error);
      }
    })
  );
}
