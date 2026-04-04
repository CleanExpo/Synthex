/**
 * Database Query Optimizer
 *
 * @description Provides query optimization utilities including:
 * - Connection pooling configuration
 * - Query result caching with TTL
 * - Query timing and metrics
 * - Batch query execution
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection string (CRITICAL)
 * - REDIS_URL: Redis connection for query caching (SECRET)
 *
 * FAILURE MODE: Falls back to uncached queries if Redis unavailable
 */

import { getRedisClient } from '../redis-client';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface QueryMetrics {
  queryName: string;
  duration: number;
  cached: boolean;
  timestamp: Date;
}

export interface CachedQueryOptions {
  ttlSeconds?: number;
  bypassCache?: boolean;
  tags?: string[];
}

export interface QueryResult<T> {
  data: T;
  metrics: QueryMetrics;
}

export interface BatchQueryResult<T> {
  results: T[];
  errors: Array<{ index: number; error: Error }>;
  totalDuration: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Connection pool configuration for database connections
 * Optimized for serverless environments like Vercel
 */
export const POOL_CONFIG = {
  // Minimum number of connections to keep in pool
  min: 2,
  // Maximum number of connections allowed
  max: 10,
  // How long a connection can be idle before being closed (ms)
  idleTimeoutMillis: 30000,
  // How long to wait for a connection before timing out (ms)
  connectionTimeoutMillis: 2000,
  // Maximum number of queued connection requests
  maxWaitingClients: 50,
  // Validate connection before use
  validateConnection: true,
};

/**
 * Default cache TTL values for different query types
 */
export const CACHE_TTL = {
  // User data - short TTL due to frequent updates
  user: 60,
  // Posts and content - medium TTL
  posts: 120,
  // Analytics data - longer TTL as it's computed
  analytics: 300,
  // Static reference data - long TTL
  reference: 3600,
  // List/collection queries
  list: 60,
};

// ============================================================================
// QUERY OPTIMIZER CLASS
// ============================================================================

export class QueryOptimizer {
  private static metrics: QueryMetrics[] = [];
  private static readonly MAX_METRICS = 1000;

  /**
   * Execute a query with caching support
   * @param key - Unique cache key for the query
   * @param query - The query function to execute
   * @param options - Caching options
   */
  static async cachedQuery<T>(
    key: string,
    query: () => Promise<T>,
    options: CachedQueryOptions = {}
  ): Promise<QueryResult<T>> {
    const {
      ttlSeconds = CACHE_TTL.reference,
      bypassCache = false,
      tags = [],
    } = options;

    const startTime = Date.now();
    const cacheKey = `query:${key}`;

    // Try to get from cache unless bypassing
    if (!bypassCache) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);

        if (cached) {
          const duration = Date.now() - startTime;
          const metrics: QueryMetrics = {
            queryName: key,
            duration,
            cached: true,
            timestamp: new Date(),
          };

          this.recordMetrics(metrics);

          return {
            data: JSON.parse(cached) as T,
            metrics,
          };
        }
      } catch (error) {
        // Log cache miss but continue with query
        logger.warn('Cache read failed, executing query directly', { key, error });
      }
    }

    // Execute the query
    const data = await query();
    const duration = Date.now() - startTime;

    // Store in cache
    try {
      const redis = getRedisClient();
      await redis.set(cacheKey, JSON.stringify(data), ttlSeconds);

      // Store cache tags for invalidation
      if (tags.length > 0) {
        for (const tag of tags) {
          await redis.set(`tag:${tag}:${cacheKey}`, '1', ttlSeconds);
        }
      }
    } catch (error) {
      logger.warn('Cache write failed', { key, error });
    }

    const metrics: QueryMetrics = {
      queryName: key,
      duration,
      cached: false,
      timestamp: new Date(),
    };

    this.recordMetrics(metrics);

    return { data, metrics };
  }

  /**
   * Invalidate cache for a specific key
   */
  static async invalidateCache(key: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`query:${key}`);
      logger.debug('Cache invalidated', { key });
    } catch (error) {
      logger.error('Cache invalidation failed', { key, error });
    }
  }

  /**
   * Invalidate all cache entries with a specific tag
   */
  static async invalidateByTag(tag: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`tag:${tag}:*`);

      if (keys.length === 0) return 0;

      // Extract cache keys from tag keys
      const cacheKeys = keys.map(k => k.replace(`tag:${tag}:`, ''));

      // Delete both the cache entries and the tag entries
      await redis.del([...keys, ...cacheKeys]);

      logger.debug('Cache invalidated by tag', { tag, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error('Tag invalidation failed', { tag, error });
      return 0;
    }
  }

  /**
   * Execute multiple queries in a batch
   */
  static async batchQuery<T>(
    queries: Array<{ key: string; query: () => Promise<T>; options?: CachedQueryOptions }>
  ): Promise<BatchQueryResult<T>> {
    const startTime = Date.now();
    const results: T[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    // Execute queries in parallel
    const promises = queries.map(async ({ key, query, options }, index) => {
      try {
        const result = await this.cachedQuery(key, query, options);
        return { index, data: result.data, error: null };
      } catch (error) {
        return { index, data: null, error: error as Error };
      }
    });

    const settled = await Promise.all(promises);

    // Sort by index to maintain order
    settled.sort((a, b) => a.index - b.index);

    for (const result of settled) {
      if (result.error) {
        errors.push({ index: result.index, error: result.error });
      } else {
        results.push(result.data as T);
      }
    }

    return {
      results,
      errors,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Record query metrics for monitoring
   */
  private static recordMetrics(metrics: QueryMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get query performance statistics
   */
  static getStatistics(): {
    totalQueries: number;
    cacheHitRate: number;
    averageDuration: number;
    p95Duration: number;
    p99Duration: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        cacheHitRate: 0,
        averageDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const cached = this.metrics.filter(m => m.cached).length;
    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b);

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      totalQueries: this.metrics.length,
      cacheHitRate: cached / this.metrics.length,
      averageDuration: sum / this.metrics.length,
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
    };
  }

  /**
   * Clear metrics history
   */
  static clearMetrics(): void {
    this.metrics = [];
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Generate a cache key from query parameters
 */
export function generateCacheKey(
  entity: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${JSON.stringify(params[k])}`)
    .join('&');

  return `${entity}:${sortedParams}`;
}

/**
 * Wrap a Prisma query with optimization
 */
export async function optimizedQuery<T>(
  entity: string,
  params: Record<string, unknown>,
  query: () => Promise<T>,
  options?: CachedQueryOptions
): Promise<T> {
  const key = generateCacheKey(entity, params);
  const result = await QueryOptimizer.cachedQuery(key, query, options);
  return result.data;
}

/**
 * Create pagination parameters with optimization hints
 */
export function paginationParams(
  page: number,
  limit: number,
  maxLimit: number = 100
): { skip: number; take: number } {
  const safeLimit = Math.min(Math.max(1, limit), maxLimit);
  const safePage = Math.max(1, page);

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}

// Export default
export default QueryOptimizer;
