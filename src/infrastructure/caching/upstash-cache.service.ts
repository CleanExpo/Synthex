/**
 * Upstash Cache Service Implementation
 * Optimized for serverless environments like Vercel
 */

import { ICacheService, InfrastructureError, ILogger } from '../../architecture/layer-interfaces';
import { Redis } from '@upstash/redis';

export class UpstashCacheService implements ICacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private logger: ILogger;
  private isRedisAvailable = false;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MEMORY_CACHE_MAX_SIZE = 1000;

  constructor(logger: ILogger, upstashUrl?: string, upstashToken?: string) {
    this.logger = logger;
    
    if (upstashUrl && upstashToken) {
      this.initializeUpstash(upstashUrl, upstashToken);
    } else {
      this.logger.warn('No Upstash credentials provided, using in-memory cache only');
    }
  }

  /**
   * Initialize Upstash Redis connection
   */
  private initializeUpstash(url: string, token: string): void {
    try {
      this.redis = new Redis({
        url,
        token,
      });
      
      this.isRedisAvailable = true;
      this.logger.info('Upstash Redis initialized successfully');
      
      // Test connection
      this.redis.ping().then(() => {
        this.logger.info('Upstash Redis connection verified');
      }).catch((error) => {
        this.logger.error('Upstash Redis ping failed', error);
        this.isRedisAvailable = false;
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize Upstash Redis', error as Error);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          const result = await this.redis.get(key);
          if (result !== null) {
            this.logger.debug(`Cache hit (Upstash): ${key}`);
            return result as T;
          }
        } catch (error) {
          this.logger.warn(`Upstash get failed for key ${key}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && memoryItem.expires > Date.now()) {
        this.logger.debug(`Cache hit (Memory): ${key}`);
        return memoryItem.value as T;
      }

      // Remove expired item
      if (memoryItem) {
        this.memoryCache.delete(key);
      }

      this.logger.debug(`Cache miss: ${key}`);
      return null;

    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error as Error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          await this.redis.set(key, value, { ex: ttl });
          this.logger.debug(`Cache set (Upstash): ${key}, TTL: ${ttl}s`);
          
          // Also set in memory cache for faster access
          this.ensureMemoryCacheSize();
          this.memoryCache.set(key, {
            value,
            expires: Date.now() + (ttl * 1000)
          });
          
          return;
        } catch (error) {
          this.logger.warn(`Upstash set failed for key ${key}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      this.ensureMemoryCacheSize();
      this.memoryCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });
      
      this.logger.debug(`Cache set (Memory): ${key}, TTL: ${ttl}s`);

    } catch (error) {
      throw new InfrastructureError(
        `Failed to set cache key: ${key}`,
        'CACHE_SET_ERROR',
        500,
        { key, ttl },
        error as Error
      );
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          await this.redis.del(key);
          this.logger.debug(`Cache delete (Upstash): ${key}`);
        } catch (error) {
          this.logger.warn(`Upstash delete failed for key ${key}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Also delete from memory cache
      this.memoryCache.delete(key);
      this.logger.debug(`Cache delete (Memory): ${key}`);

    } catch (error) {
      throw new InfrastructureError(
        `Failed to delete cache key: ${key}`,
        'CACHE_DELETE_ERROR',
        500,
        { key },
        error as Error
      );
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // Clear Upstash if available
      if (this.isRedisAvailable && this.redis) {
        try {
          await this.redis.flushdb();
          this.logger.info('Upstash cache cleared');
        } catch (error) {
          this.logger.warn('Upstash clear failed', error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Clear memory cache
      this.memoryCache.clear();
      this.logger.info('Memory cache cleared');

    } catch (error) {
      throw new InfrastructureError(
        'Failed to clear cache',
        'CACHE_CLEAR_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      // Check Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          const exists = await this.redis.exists(key);
          if (exists === 1) {
            return true;
          }
        } catch (error) {
          this.logger.warn(`Upstash exists check failed for key ${key}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Check memory cache
      const memoryItem = this.memoryCache.get(key);
      return memoryItem !== undefined && memoryItem.expires > Date.now();

    } catch (error) {
      this.logger.error(`Cache exists check error for key ${key}`, error as Error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis && keys.length > 0) {
        try {
          const results = await this.redis.mget(...keys);
          return results as (T | null)[];
        } catch (error) {
          this.logger.warn(`Upstash mget failed for keys ${keys.join(', ')}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      return keys.map(key => {
        const memoryItem = this.memoryCache.get(key);
        if (memoryItem && memoryItem.expires > Date.now()) {
          return memoryItem.value as T;
        }
        return null;
      });

    } catch (error) {
      this.logger.error(`Cache mget error for keys ${keys.join(', ')}`, error as Error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis && keyValuePairs.length > 0) {
        try {
          const pipeline = this.redis.pipeline();
          
          for (const { key, value, ttl = this.DEFAULT_TTL } of keyValuePairs) {
            pipeline.set(key, value, { ex: ttl });
          }
          
          await pipeline.exec();
          this.logger.debug(`Cache mset (Upstash): ${keyValuePairs.length} keys`);
          
          // Also set in memory cache
          this.ensureMemoryCacheSize();
          for (const { key, value, ttl = this.DEFAULT_TTL } of keyValuePairs) {
            this.memoryCache.set(key, {
              value,
              expires: Date.now() + (ttl * 1000)
            });
          }
          
          return;
        } catch (error) {
          this.logger.warn(`Upstash mset failed`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      this.ensureMemoryCacheSize();
      
      for (const { key, value, ttl = this.DEFAULT_TTL } of keyValuePairs) {
        this.memoryCache.set(key, {
          value,
          expires: Date.now() + (ttl * 1000)
        });
      }
      
      this.logger.debug(`Cache mset (Memory): ${keyValuePairs.length} keys`);

    } catch (error) {
      throw new InfrastructureError(
        'Failed to set multiple cache keys',
        'CACHE_MSET_ERROR',
        500,
        { count: keyValuePairs.length },
        error as Error
      );
    }
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          const result = await this.redis.incrby(key, amount);
          
          // Update memory cache
          this.memoryCache.set(key, {
            value: result,
            expires: Date.now() + (this.DEFAULT_TTL * 1000)
          });
          
          return result;
        } catch (error) {
          this.logger.warn(`Upstash increment failed for key ${key}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue);
      return newValue;

    } catch (error) {
      throw new InfrastructureError(
        `Failed to increment cache key: ${key}`,
        'CACHE_INCREMENT_ERROR',
        500,
        { key, amount },
        error as Error
      );
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redisAvailable: boolean;
    memoryCacheSize: number;
    memoryCacheHits: number;
    memoryCacheMisses: number;
  }> {
    return {
      redisAvailable: this.isRedisAvailable,
      memoryCacheSize: this.memoryCache.size,
      memoryCacheHits: 0, // Could implement tracking
      memoryCacheMisses: 0
    };
  }

  /**
   * Get keys matching pattern
   */
  async getKeys(pattern: string): Promise<string[]> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const keys = await this.redis.keys(pattern);
        return keys;
      }

      // For memory cache, do basic pattern matching
      const keys = Array.from(this.memoryCache.keys());
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));

    } catch (error) {
      this.logger.error(`Failed to get keys for pattern ${pattern}`, error as Error);
      return [];
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.getKeys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      // Try Upstash first if available
      if (this.isRedisAvailable && this.redis) {
        try {
          const deleted = await this.redis.del(...keys);
          this.logger.debug(`Deleted ${deleted} keys from Upstash matching pattern: ${pattern}`);
          
          // Also delete from memory cache
          keys.forEach(key => this.memoryCache.delete(key));
          
          return deleted;
        } catch (error) {
          this.logger.warn(`Upstash delete pattern failed for ${pattern}`, error as Error);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache only
      let deleted = 0;
      keys.forEach(key => {
        if (this.memoryCache.delete(key)) {
          deleted++;
        }
      });

      this.logger.debug(`Deleted ${deleted} keys from memory cache matching pattern: ${pattern}`);
      return deleted;

    } catch (error) {
      this.logger.error(`Failed to delete pattern ${pattern}`, error as Error);
      return 0;
    }
  }

  /**
   * Ensure memory cache doesn't exceed max size
   */
  private ensureMemoryCacheSize(): void {
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
      // Remove oldest entries (simple LRU)
      const entries = Array.from(this.memoryCache.entries());
      const toRemove = entries
        .sort((a, b) => a[1].expires - b[1].expires)
        .slice(0, Math.floor(this.MEMORY_CACHE_MAX_SIZE * 0.1)); // Remove 10%

      toRemove.forEach(([key]) => {
        this.memoryCache.delete(key);
      });

      this.logger.debug(`Removed ${toRemove.length} entries from memory cache to prevent overflow`);
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Upstash Redis doesn't need explicit disposal
      this.redis = null;
      this.isRedisAvailable = false;

      this.logger.info('Upstash cache service disposed');

    } catch (error) {
      this.logger.error('Error disposing Upstash cache service', error as Error);
    }
  }
}