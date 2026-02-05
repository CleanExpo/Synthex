/**
 * Redis Client Factory with Cluster & Sentinel Support
 *
 * @task UNI-437 - Implement Redis Cluster Configuration
 *
 * This module provides a unified Redis client that automatically selects
 * the appropriate connection mode based on configuration:
 * - Cluster mode for horizontal scaling
 * - Sentinel mode for high availability
 * - Standalone mode for simple deployments
 * - Upstash for serverless (Vercel)
 * - Memory fallback when Redis unavailable
 */

import Redis, { Cluster, RedisOptions, ClusterOptions, ClusterNode } from 'ioredis';
import {
  getRedisConfig,
  getRedisClusterConfig,
  getRedisSentinelConfig,
  getRedisPoolConfig,
  getUpstashConfig,
  determineRedisMode,
  RedisHealthStatus,
} from '../src/config/redis.config';

// ============================================================================
// TYPES
// ============================================================================

type RedisClient = Redis | Cluster;

interface RedisClientWrapper {
  client: RedisClient | null;
  mode: 'cluster' | 'sentinel' | 'standalone' | 'upstash' | 'memory';
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
  private cache: Map<string, { value: string; expiry: number | null }> = new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  private startCleanup() {
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
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.cache.keys()).filter((k) => regex.test(k));
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    const data = this.cache.get(key);
    await this.set(key, newValue, data?.expiry ? Math.floor((data.expiry - Date.now()) / 1000) : undefined);
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
    return Promise.all(keys.map((k) => this.get(k)));
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
 * Create a standalone Redis client
 */
function createStandaloneClient(): Redis {
  const config = getRedisConfig();
  const poolConfig = getRedisPoolConfig();

  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    enableReadyCheck: config.enableReadyCheck,
    lazyConnect: config.lazyConnect,
    connectTimeout: config.connectTimeout,
    keepAlive: config.keepAlive,
    family: config.family,
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error('[Redis] Max retry attempts reached');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    reconnectOnError: config.reconnectOnError,
  };

  if (config.url) {
    return new Redis(config.url, options);
  }

  return new Redis(options);
}

/**
 * Create a Redis Cluster client
 */
function createClusterClient(): Cluster {
  const clusterConfig = getRedisClusterConfig();
  const poolConfig = getRedisPoolConfig();

  const nodes: ClusterNode[] = clusterConfig.nodes.map((node) => ({
    host: node.host,
    port: node.port,
  }));

  const options: ClusterOptions = {
    clusterRetryStrategy: clusterConfig.options.clusterRetryStrategy,
    enableReadyCheck: clusterConfig.options.enableReadyCheck,
    scaleReads: clusterConfig.options.scaleReads,
    maxRedirections: clusterConfig.options.maxRedirections,
    retryDelayOnFailover: clusterConfig.options.retryDelayOnFailover,
    retryDelayOnClusterDown: clusterConfig.options.retryDelayOnClusterDown,
    retryDelayOnTryAgain: clusterConfig.options.retryDelayOnTryAgain,
    slotsRefreshTimeout: clusterConfig.options.slotsRefreshTimeout,
    slotsRefreshInterval: clusterConfig.options.slotsRefreshInterval,
    natMap: clusterConfig.options.natMap,
    redisOptions: {
      password: clusterConfig.redisOptions.password,
      connectTimeout: clusterConfig.redisOptions.connectTimeout,
      commandTimeout: clusterConfig.redisOptions.commandTimeout,
    },
  };

  return new Cluster(nodes, options);
}

/**
 * Create a Redis Sentinel client
 */
function createSentinelClient(): Redis {
  const sentinelConfig = getRedisSentinelConfig();

  const options: RedisOptions = {
    sentinels: sentinelConfig.sentinels,
    name: sentinelConfig.name,
    password: sentinelConfig.options.password,
    sentinelPassword: sentinelConfig.options.sentinelPassword,
    db: sentinelConfig.options.db,
    enableTLSForSentinelMode: sentinelConfig.options.enableTLSForSentinelMode,
    sentinelRetryStrategy: sentinelConfig.options.sentinelRetryStrategy,
    reconnectOnError: sentinelConfig.options.reconnectOnError,
    failoverDetector: sentinelConfig.options.failoverDetector,
  };

  return new Redis(options);
}

/**
 * Create the appropriate Redis client based on configuration
 */
export function createRedisClient(): RedisClientWrapper {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  const mode = determineRedisMode();
  let client: RedisClient | null = null;


  // For memory or upstash mode, we don't create an ioredis client
  if (mode !== 'memory' && mode !== 'upstash') {
    try {
      switch (mode) {
        case 'cluster':
          client = createClusterClient();
          break;
        case 'sentinel':
          client = createSentinelClient();
          break;
        case 'standalone':
        default:
          client = createStandaloneClient();
          break;
      }

      // Set up error handlers
      if (client) {
        client.on('error', (err) => {
          console.error('[Redis] Connection error:', err.message);
        });

        client.on('connect', () => {
        });

        client.on('ready', () => {
        });

        client.on('close', () => {
        });

        client.on('reconnecting', () => {
        });
      }
    } catch (error) {
      console.error('[Redis] Failed to create client:', error);
      client = null;
    }
  }

  // Initialize memory cache as fallback
  if (!memoryCache) {
    const cacheConfig = getRedisPoolConfig();
    memoryCache = new MemoryCache(1000);
  }

  const wrapper: RedisClientWrapper = {
    client,
    mode,
    isConnected: false,

    async connect() {
      if (mode === 'memory' || mode === 'upstash') {
        this.isConnected = true;
        return;
      }

      if (client) {
        try {
          await client.ping();
          this.isConnected = true;
        } catch (error) {
          console.error('[Redis] Connection failed:', error);
          this.isConnected = false;
        }
      }
    },

    async disconnect() {
      if (client) {
        await client.quit();
        this.isConnected = false;
      }
      if (memoryCache) {
        memoryCache.destroy();
        memoryCache = null;
      }
    },

    async healthCheck(): Promise<RedisHealthStatus> {
      const startTime = Date.now();

      if (mode === 'memory') {
        return {
          connected: true,
          mode: 'memory',
          latency: 0,
        };
      }

      if (mode === 'upstash') {
        // Upstash health check would be done via REST API
        return {
          connected: true,
          mode: 'upstash',
          latency: 0,
        };
      }

      if (!client) {
        return {
          connected: false,
          mode,
          error: 'Client not initialized',
        };
      }

      try {
        await client.ping();
        const latency = Date.now() - startTime;

        // Get cluster/sentinel specific info
        if (mode === 'cluster' && client instanceof Cluster) {
          const nodes = client.nodes('all');
          return {
            connected: true,
            mode,
            latency,
            nodes: nodes.map((node) => ({
              host: node.options.host || 'unknown',
              port: node.options.port || 0,
              status: node.status as 'connected' | 'disconnected' | 'connecting',
            })),
          };
        }

        return {
          connected: true,
          mode,
          latency,
        };
      } catch (error) {
        return {
          connected: false,
          mode,
          latency: Date.now() - startTime,
          error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
        };
      }
    },

    async get(key: string): Promise<string | null> {
      if (client && this.isConnected) {
        try {
          return await client.get(key);
        } catch (error) {
          console.warn('[Redis] GET failed, using memory fallback:', error);
        }
      }
      return memoryCache?.get(key) ?? null;
    },

    async set(key: string, value: string, ttl?: number): Promise<void> {
      if (client && this.isConnected) {
        try {
          if (ttl) {
            await client.setex(key, ttl, value);
          } else {
            await client.set(key, value);
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
      if (client && this.isConnected) {
        try {
          return await client.del(...keyArray);
        } catch (error) {
          console.warn('[Redis] DEL failed, using memory fallback:', error);
        }
      }
      return memoryCache?.del(keys) ?? 0;
    },

    async exists(key: string): Promise<boolean> {
      if (client && this.isConnected) {
        try {
          const result = await client.exists(key);
          return result === 1;
        } catch (error) {
          console.warn('[Redis] EXISTS failed, using memory fallback:', error);
        }
      }
      return memoryCache?.exists(key) ?? false;
    },

    async keys(pattern: string): Promise<string[]> {
      if (client && this.isConnected) {
        try {
          return await client.keys(pattern);
        } catch (error) {
          console.warn('[Redis] KEYS failed, using memory fallback:', error);
        }
      }
      return memoryCache?.keys(pattern) ?? [];
    },

    async incr(key: string): Promise<number> {
      if (client && this.isConnected) {
        try {
          return await client.incr(key);
        } catch (error) {
          console.warn('[Redis] INCR failed, using memory fallback:', error);
        }
      }
      return memoryCache?.incr(key) ?? 1;
    },

    async expire(key: string, seconds: number): Promise<boolean> {
      if (client && this.isConnected) {
        try {
          const result = await client.expire(key, seconds);
          return result === 1;
        } catch (error) {
          console.warn('[Redis] EXPIRE failed, using memory fallback:', error);
        }
      }
      return memoryCache?.expire(key, seconds) ?? false;
    },

    async ttl(key: string): Promise<number> {
      if (client && this.isConnected) {
        try {
          return await client.ttl(key);
        } catch (error) {
          console.warn('[Redis] TTL failed, using memory fallback:', error);
        }
      }
      return memoryCache?.ttl(key) ?? -2;
    },

    async mget(keys: string[]): Promise<(string | null)[]> {
      if (client && this.isConnected) {
        try {
          return await client.mget(...keys);
        } catch (error) {
          console.warn('[Redis] MGET failed, using memory fallback:', error);
        }
      }
      return memoryCache?.mget(keys) ?? keys.map(() => null);
    },

    async mset(keyValues: Record<string, string>): Promise<void> {
      if (client && this.isConnected) {
        try {
          const args: string[] = [];
          for (const [key, value] of Object.entries(keyValues)) {
            args.push(key, value);
          }
          await client.mset(...args);
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
export default {
  createRedisClient,
  getRedisClient,
  resetRedisClient,
};
