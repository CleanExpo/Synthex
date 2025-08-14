/**
 * Redis Configuration
 * Centralized Redis configuration for caching and session management
 */

export interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  maxLoadingTimeout: number;
  lazyConnect: boolean;
  connectTimeout: number;
  keepAlive: number;
  family: 4 | 6;
  retryDelayOnFailover: number;
  showFriendlyErrorStack: boolean;
  enableOfflineQueue: boolean;
  reconnectOnError: (err: Error) => boolean | 1 | 2;
}

/**
 * Get Redis configuration from environment variables
 */
export function getRedisConfig(): RedisConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Build Redis URL if individual components are provided
  let redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl && process.env.REDIS_HOST) {
    const auth = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const db = process.env.REDIS_DB || '0';
    
    redisUrl = `redis://${auth}${host}:${port}/${db}`;
  }
  
  // For production (Vercel), use Redis Cloud or Upstash
  if (!redisUrl && process.env.VERCEL) {
    // Use Upstash Redis for Vercel deployments
    redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  }
  
  return {
    url: redisUrl,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'synthex:',
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    enableReadyCheck: true,
    maxLoadingTimeout: 10000,
    lazyConnect: true,
    connectTimeout: 5000,
    keepAlive: 30000,
    family: 4,
    retryDelayOnFailover: 100,
    showFriendlyErrorStack: isDevelopment,
    enableOfflineQueue: true,
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return 2;
      }
      return false;
    }
  };
}

/**
 * Redis connection string builder
 */
export function getRedisConnectionString(): string | undefined {
  const config = getRedisConfig();
  
  if (config.url) {
    return config.url;
  }
  
  const auth = config.password ? `:${config.password}@` : '';
  return `redis://${auth}${config.host}:${config.port}/${config.db}`;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTTL: number;
  maxMemoryItems: number;
  enableRedis: boolean;
  enableInMemoryFallback: boolean;
  cleanupInterval: number;
}

/**
 * Get cache configuration
 */
export function getCacheConfig(): CacheConfig {
  return {
    defaultTTL: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
    maxMemoryItems: parseInt(process.env.CACHE_MAX_MEMORY_ITEMS || '1000', 10),
    enableRedis: process.env.DISABLE_REDIS !== 'true',
    enableInMemoryFallback: true,
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000', 10), // 5 minutes
  };
}

/**
 * Upstash Redis configuration for serverless
 */
export interface UpstashConfig {
  url?: string;
  token?: string;
}

/**
 * Get Upstash configuration for Vercel deployments
 */
export function getUpstashConfig(): UpstashConfig | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  
  return {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}