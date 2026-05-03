/**
 * Redis Client Factory
 *
 * @task SYN-442 - Swap Redis client to Upstash SDK
 *
 * This module provides a unified Redis client that automatically selects
 * the appropriate connection mode based on configuration:
 * - Upstash for serverless (Vercel) — primary mode, uses @upstash/redis SDK
 * - Memory fallback when Redis unavailable
 *
 * Cluster and Sentinel modes are intentionally removed: Synthex is deployed
 * on Vercel serverless where persistent TCP connections are not viable.
 * Upstash REST API is the correct transport for this environment.
 */

import { Redis } from '@upstash/redis';
import {
  getUpstashConfig,
  determineRedisMode,
  RedisHealthStatus,
} from '@/lib/config/redis.config';

// ============================================================================
// TYPES
// ============================================================================

interface RedisClientWrapper {
  client: Redis | null;
  mode: 'upstash' | 'memory';
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  healthCheck: () => Promise<RedisHealthStatus>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string | string[]) => Promise<number>;
  exists: (key: string) => Promise<boolean>;
  keys: (pattern: string) => Promise<string[]>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
  ttl: (key: string) => Promise<number>;
  mget: (keys: string[]) => Promise<(string | null)[]>;
  mset: (keyValues: Record<string, string>) => Promise<void>;
}

// ============================================================================
// MEMORY FALLBACK CACHE
// ============================================================================

class MemoryCache {
  private cache: Map<string, { value: string; expiry: number | null }> =
    new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  private startCleanup() {
    if (this.cleanupInterval) return; // Prevent double-start
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());
      for (const [key, data] of entries) {
        if (data.expiry && data.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  async get(key: string): Promise<string | null> {
    const data = this.cache.get(key);
    if (!data) return null;
    if (data.expiry && data.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return data.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const keys = Array.from(this.cache.keys());
      if (keys.length > 0) this.cache.delete(keys[0]);
    }
    this.cache.set(key, {
      value,
      expiry: ttl ? Date.now() + ttl * 1000 : null,
    });
  }

  async del(keys: string | string[]): Promise<number> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    let deleted = 0;
    for (const key of keyArray) {
      if (this.cache.delete(key)) deleted++;
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async keys(pattern: string): Promise<string[]> {
    // Escape regex metacharacters in `pattern` first so a caller can't
    // inject arbitrary regex (CodeQL js/regex-injection). Then translate
    // the Redis glob `*` (now escaped as `\*`) back into the regex `.*`.
    const escaped = pattern.replace(/[\\^$.+?()[\]{}|]/g, '\\$&');
    const regex = new RegExp('^' + escaped.replace(/\\\*/g, '.*') + '$');
    return Array.from(this.cache.keys()).filter(k => regex.test(k));
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    const data = this.cache.get(key);
    await this.set(
      key,
      newValue,
      data?.expiry ? Math.floor((data.expiry - Date.now()) / 1000) : undefined
    );
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const data = this.cache.get(key);
    if (!data) return false;
    data.expiry = Date.now() + seconds * 1000;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const data = this.cache.get(key);
    if (!data) return -2;
    if (!data.expiry) return -1;
    const remaining = Math.floor((data.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(k => this.get(k)));
  }

  async mset(keyValues: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(keyValues)) {
      await this.set(key, value);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// ============================================================================
// REDIS CLIENT FACTORY
// ============================================================================

let redisClientInstance: RedisClientWrapper | null = null;
let memoryCache: MemoryCache | null = null;

/**
 * Create the appropriate Redis client based on configuration.
 * On Vercel (serverless), Upstash mode is selected automatically when
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 */
export function createRedisClient(): RedisClientWrapper {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  const rawMode = determineRedisMode();
  // Collapse any non-upstash TCP mode to memory — serverless cannot hold
  // persistent TCP connections. Upstash REST is the only viable remote store.
  const mode: 'upstash' | 'memory' =
    rawMode === 'upstash' ? 'upstash' : 'memory';

  // Build Upstash client if credentials are present
  let upstashClient: Redis | null = null;
  if (mode === 'upstash') {
    try {
      const upstashConfig = getUpstashConfig();
      if (upstashConfig?.url && upstashConfig?.token) {
        upstashClient = new Redis({
          url: upstashConfig.url,
          token: upstashConfig.token,
        });
      }
    } catch (error) {
      console.error('[Redis] Failed to create Upstash client:', error);
      upstashClient = null;
    }
  }

  // Initialise memory cache as fallback
  if (!memoryCache) {
    memoryCache = new MemoryCache(1000);
  }

  const wrapper: RedisClientWrapper = {
    client: upstashClient,
    mode,
    isConnected: false,

    async connect() {
      if (upstashClient) {
        try {
          await upstashClient.ping();
          this.isConnected = true;
        } catch (error) {
          console.error('[Redis] Upstash connection failed:', error);
          this.isConnected = false;
        }
      } else {
        // Memory mode — always "connected"
        this.isConnected = true;
      }
    },

    async disconnect() {
      this.isConnected = false;
      if (memoryCache) {
        memoryCache.destroy();
        memoryCache = null;
      }
    },

    async healthCheck(): Promise<RedisHealthStatus> {
      const startTime = Date.now();

      if (mode === 'memory' || !upstashClient) {
        return {
          connected: true,
          mode: 'memory',
          latency: 0,
        };
      }

      try {
        await upstashClient.ping();
        return {
          connected: true,
          mode: 'upstash',
          latency: Date.now() - startTime,
        };
      } catch (error) {
        return {
          connected: false,
          mode: 'upstash',
          latency: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    async get(key: string): Promise<string | null> {
      if (upstashClient) {
        try {
          const value = await upstashClient.get<string>(key);
          return value ?? null;
        } catch (error) {
          console.warn('[Redis] GET failed, using memory fallback:', error);
        }
      }
      return memoryCache?.get(key) ?? null;
    },

    async set(key: string, value: string, ttl?: number): Promise<void> {
      if (upstashClient) {
        try {
          if (ttl) {
            await upstashClient.setex(key, ttl, value);
          } else {
            await upstashClient.set(key, value);
          }
          return;
        } catch (error) {
          console.warn('[Redis] SET failed, using memory fallback:', error);
        }
      }
      await memoryCache?.set(key, value, ttl);
    },

    async del(keys: string | string[]): Promise<number> {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      if (upstashClient) {
        try {
          return await upstashClient.del(...keyArray);
        } catch (error) {
          console.warn('[Redis] DEL failed, using memory fallback:', error);
        }
      }
      return memoryCache?.del(keys) ?? 0;
    },

    async exists(key: string): Promise<boolean> {
      if (upstashClient) {
        try {
          const result = await upstashClient.exists(key);
          return result === 1;
        } catch (error) {
          console.warn('[Redis] EXISTS failed, using memory fallback:', error);
        }
      }
      return memoryCache?.exists(key) ?? false;
    },

    async keys(pattern: string): Promise<string[]> {
      if (upstashClient) {
        try {
          return await upstashClient.keys(pattern);
        } catch (error) {
          console.warn('[Redis] KEYS failed, using memory fallback:', error);
        }
      }
      return memoryCache?.keys(pattern) ?? [];
    },

    async incr(key: string): Promise<number> {
      if (upstashClient) {
        try {
          return await upstashClient.incr(key);
        } catch (error) {
          console.warn('[Redis] INCR failed, using memory fallback:', error);
        }
      }
      return memoryCache?.incr(key) ?? 1;
    },

    async expire(key: string, seconds: number): Promise<boolean> {
      if (upstashClient) {
        try {
          const result = await upstashClient.expire(key, seconds);
          return result === 1;
        } catch (error) {
          console.warn('[Redis] EXPIRE failed, using memory fallback:', error);
        }
      }
      return memoryCache?.expire(key, seconds) ?? false;
    },

    async ttl(key: string): Promise<number> {
      if (upstashClient) {
        try {
          return await upstashClient.ttl(key);
        } catch (error) {
          console.warn('[Redis] TTL failed, using memory fallback:', error);
        }
      }
      return memoryCache?.ttl(key) ?? -2;
    },

    async mget(keys: string[]): Promise<(string | null)[]> {
      if (upstashClient) {
        try {
          const results = await upstashClient.mget<(string | null)[]>(...keys);
          return results;
        } catch (error) {
          console.warn('[Redis] MGET failed, using memory fallback:', error);
        }
      }
      return memoryCache?.mget(keys) ?? keys.map(() => null);
    },

    async mset(keyValues: Record<string, string>): Promise<void> {
      if (upstashClient) {
        try {
          // Upstash mset accepts an object directly
          await upstashClient.mset(keyValues);
          return;
        } catch (error) {
          console.warn('[Redis] MSET failed, using memory fallback:', error);
        }
      }
      await memoryCache?.mset(keyValues);
    },
  };

  redisClientInstance = wrapper;
  return wrapper;
}

/**
 * Get the singleton Redis client instance
 */
export function getRedisClient(): RedisClientWrapper {
  if (!redisClientInstance) {
    return createRedisClient();
  }
  return redisClientInstance;
}

/**
 * Reset the Redis client (for testing)
 */
export async function resetRedisClient(): Promise<void> {
  if (redisClientInstance) {
    await redisClientInstance.disconnect();
    redisClientInstance = null;
  }
}

// Export default
const redisClient = {
  createRedisClient,
  getRedisClient,
  resetRedisClient,
};
export default redisClient;
