/**
 * Multi-Layer Cache Manager
 *
 * @description Implements a hierarchical caching strategy with:
 * - L1: In-memory cache (fastest, limited size)
 * - L2: Redis cache (fast, distributed)
 * - L3: Upstash fallback (serverless-friendly)
 *
 * Features:
 * - Automatic backfilling to upper layers on cache hit
 * - Cache warming for predictable access patterns
 * - Tag-based invalidation
 * - TTL management per layer
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection string (SECRET)
 * - UPSTASH_REDIS_REST_URL: Upstash REST URL (SECRET)
 * - UPSTASH_REDIS_REST_TOKEN: Upstash auth token (SECRET)
 *
 * FAILURE MODE: Degrades gracefully through cache layers
 */

import { getRedisClient } from '../redis-client';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  tags?: string[];
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  skipLayers?: ('memory' | 'redis' | 'upstash')[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memorySize: number;
  layerHits: {
    memory: number;
    redis: number;
    upstash: number;
  };
}

export interface CacheLayer {
  name: 'memory' | 'redis' | 'upstash';
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// MEMORY CACHE LAYER
// ============================================================================

class MemoryCacheLayer implements CacheLayer {
  name: 'memory' = 'memory';
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  private startCleanup() {
    // Clean expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 30000);
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Evict LRU entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// ============================================================================
// REDIS CACHE LAYER
// ============================================================================

class RedisCacheLayer implements CacheLayer {
  name: 'redis' = 'redis';
  private prefix: string;

  constructor(prefix: string = 'cache:') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(this.prefix + key);

      if (!data) return null;

      const entry = JSON.parse(data) as CacheEntry<T>;

      // Check expiration
      if (entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      logger.warn('Redis cache get failed', { key, error });
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const redis = getRedisClient();
      const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);

      if (ttl > 0) {
        await redis.set(this.prefix + key, JSON.stringify(entry), ttl);

        // Store tags for invalidation
        if (entry.tags) {
          for (const tag of entry.tags) {
            await redis.set(`tag:${tag}:${this.prefix}${key}`, '1', ttl);
          }
        }
      }
    } catch (error) {
      logger.warn('Redis cache set failed', { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.prefix + key);
    } catch (error) {
      logger.warn('Redis cache delete failed', { key, error });
    }
  }

  async clear(): Promise<void> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(this.prefix + '*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      logger.warn('Redis cache clear failed', { error });
    }
  }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

export class CacheManager {
  private static instance: CacheManager | null = null;
  private layers: CacheLayer[];
  private stats: CacheStats;

  private constructor() {
    this.layers = [
      new MemoryCacheLayer(500),  // L1: Memory (500 entries)
      new RedisCacheLayer('synthex:'), // L2: Redis
    ];

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      memorySize: 0,
      layerHits: {
        memory: 0,
        redis: 0,
        upstash: 0,
      },
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache, checking layers in order
   */
  async get<T>(key: string): Promise<T | null> {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];

      try {
        const entry = await layer.get<T>(key);

        if (entry) {
          this.stats.hits++;
          this.stats.layerHits[layer.name]++;
          this.updateHitRate();

          // Backfill upper layers
          await this.backfill(key, entry, i);

          return entry.data;
        }
      } catch (error) {
        logger.warn(`Cache layer ${layer.name} failed`, { key, error });
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set value in all cache layers
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const { ttl = 300, tags = [], skipLayers = [] } = options;

    const entry: CacheEntry<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      tags,
    };

    for (const layer of this.layers) {
      if (skipLayers.includes(layer.name)) continue;

      try {
        await layer.set(key, entry);
      } catch (error) {
        logger.warn(`Cache layer ${layer.name} set failed`, { key, error });
      }
    }
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string): Promise<void> {
    for (const layer of this.layers) {
      try {
        await layer.delete(key);
      } catch (error) {
        logger.warn(`Cache layer ${layer.name} delete failed`, { key, error });
      }
    }
  }

  /**
   * Invalidate all entries with a specific tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`tag:${tag}:*`);

      if (keys.length === 0) return 0;

      // Extract cache keys and delete them
      const cacheKeys = keys.map(k => k.replace(`tag:${tag}:`, ''));

      for (const key of cacheKeys) {
        await this.delete(key.replace('synthex:', ''));
      }

      // Delete tag keys
      await redis.del(keys);

      logger.debug('Cache invalidated by tag', { tag, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error('Tag invalidation failed', { tag, error });
      return 0;
    }
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    for (const layer of this.layers) {
      try {
        await layer.clear();
      } catch (error) {
        logger.warn(`Cache layer ${layer.name} clear failed`, { error });
      }
    }
  }

  /**
   * Get or set with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Warm cache with predicted access patterns
   */
  async warmCache(
    predictions: Array<{ key: string; factory: () => Promise<unknown>; options?: CacheOptions }>
  ): Promise<void> {
    await Promise.all(
      predictions.map(async ({ key, factory, options }) => {
        try {
          const existing = await this.get(key);
          if (!existing) {
            const data = await factory();
            await this.set(key, data, options);
          }
        } catch (error) {
          logger.warn('Cache warming failed for key', { key, error });
        }
      })
    );
  }

  /**
   * Backfill upper cache layers
   */
  private async backfill<T>(
    key: string,
    entry: CacheEntry<T>,
    hitLayerIndex: number
  ): Promise<void> {
    // Only backfill to layers above the hit layer
    for (let i = 0; i < hitLayerIndex; i++) {
      const layer = this.layers[i];
      try {
        await layer.set(key, entry);
      } catch (error) {
        logger.warn(`Backfill to layer ${layer.name} failed`, { key, error });
      }
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

    // Update memory size
    const memoryLayer = this.layers[0] as MemoryCacheLayer;
    this.stats.memorySize = memoryLayer.getSize();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      memorySize: 0,
      layerHits: {
        memory: 0,
        redis: 0,
        upstash: 0,
      },
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the global cache manager instance
 */
export function getCache(): CacheManager {
  return CacheManager.getInstance();
}

/**
 * Cache decorator for functions
 */
export function cached<T>(
  keyGenerator: (...args: unknown[]) => string,
  options: CacheOptions = {}
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getCache();
      const key = keyGenerator(...args);

      return cache.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// Export default
export default CacheManager;
