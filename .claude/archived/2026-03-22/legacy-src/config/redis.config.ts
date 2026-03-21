/**
 * Redis Configuration with Cluster Support
 * Centralized Redis configuration for caching, session management, and high availability
 *
 * @task UNI-437 - Implement Redis Cluster Configuration
 *
 * ENVIRONMENT VARIABLES:
 * - REDIS_URL: Standard Redis connection URL
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis authentication password
 * - REDIS_DB: Redis database number (default: 0)
 * - REDIS_KEY_PREFIX: Key namespace prefix (default: synthex:)
 *
 * CLUSTER CONFIGURATION:
 * - REDIS_CLUSTER_ENABLED: Enable cluster mode (default: false)
 * - REDIS_CLUSTER_NODES: Comma-separated list of cluster nodes (host:port)
 * - REDIS_CLUSTER_NAT_MAP: NAT mapping for cluster nodes (JSON format)
 *
 * SENTINEL CONFIGURATION:
 * - REDIS_SENTINEL_ENABLED: Enable sentinel mode (default: false)
 * - REDIS_SENTINEL_NODES: Comma-separated list of sentinel nodes (host:port)
 * - REDIS_SENTINEL_MASTER: Sentinel master name (default: mymaster)
 *
 * CONNECTION POOL:
 * - REDIS_POOL_SIZE: Maximum connections (default: 10)
 * - REDIS_POOL_MIN: Minimum connections (default: 2)
 */

// ============================================================================
// INTERFACES
// ============================================================================

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

export interface RedisClusterNode {
  host: string;
  port: number;
}

export interface RedisClusterConfig {
  enabled: boolean;
  nodes: RedisClusterNode[];
  options: {
    clusterRetryStrategy: (times: number) => number | null;
    enableReadyCheck: boolean;
    scaleReads: 'master' | 'slave' | 'all';
    maxRedirections: number;
    retryDelayOnFailover: number;
    retryDelayOnClusterDown: number;
    retryDelayOnTryAgain: number;
    slotsRefreshTimeout: number;
    slotsRefreshInterval: number;
    dnsLookup?: (address: string, callback: (err: Error | null, address: string, family: number) => void) => void;
    natMap?: Record<string, { host: string; port: number }>;
  };
  redisOptions: {
    password?: string;
    connectTimeout: number;
    commandTimeout: number;
  };
}

export interface RedisSentinelConfig {
  enabled: boolean;
  sentinels: RedisClusterNode[];
  name: string;
  options: {
    sentinelPassword?: string;
    password?: string;
    db: number;
    enableTLSForSentinelMode: boolean;
    sentinelRetryStrategy: (times: number) => number | null;
    reconnectOnError: (err: Error) => boolean | 1 | 2;
    failoverDetector: boolean;
  };
}

export interface RedisPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  evictionRunInterval: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxMemoryItems: number;
  enableRedis: boolean;
  enableInMemoryFallback: boolean;
  cleanupInterval: number;
}

export interface UpstashConfig {
  url?: string;
  token?: string;
}

export interface RedisHealthStatus {
  connected: boolean;
  mode: 'standalone' | 'cluster' | 'sentinel' | 'upstash' | 'memory';
  latency?: number;
  nodes?: Array<{
    host: string;
    port: number;
    status: 'connected' | 'disconnected' | 'connecting';
    role?: 'master' | 'slave';
  }>;
  error?: string;
}

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

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
        return 2; // Reconnect and resend failed command
      }
      return false;
    },
  };
}

/**
 * Get Redis Cluster configuration
 */
export function getRedisClusterConfig(): RedisClusterConfig {
  const enabled = process.env.REDIS_CLUSTER_ENABLED === 'true';
  const nodesString = process.env.REDIS_CLUSTER_NODES || '';

  // Parse cluster nodes from environment
  const nodes: RedisClusterNode[] = nodesString
    .split(',')
    .filter(Boolean)
    .map((nodeStr) => {
      const [host, portStr] = nodeStr.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(portStr || '6379', 10),
      };
    });

  // Parse NAT map if provided (for Docker/Kubernetes environments)
  let natMap: Record<string, { host: string; port: number }> | undefined;
  if (process.env.REDIS_CLUSTER_NAT_MAP) {
    try {
      natMap = JSON.parse(process.env.REDIS_CLUSTER_NAT_MAP);
    } catch (e) {
      console.error('[Redis] Failed to parse REDIS_CLUSTER_NAT_MAP:', e);
    }
  }

  return {
    enabled,
    nodes: nodes.length > 0 ? nodes : [{ host: 'localhost', port: 6379 }],
    options: {
      clusterRetryStrategy: (times: number) => {
        if (times > 10) {
          console.error('[Redis Cluster] Max retry attempts reached');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        console.log(`[Redis Cluster] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      enableReadyCheck: true,
      scaleReads: 'slave', // Read from slaves to reduce master load
      maxRedirections: 16,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 100,
      retryDelayOnTryAgain: 100,
      slotsRefreshTimeout: 1000,
      slotsRefreshInterval: 5000,
      natMap,
    },
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 5000,
      commandTimeout: 5000,
    },
  };
}

/**
 * Get Redis Sentinel configuration for high availability
 */
export function getRedisSentinelConfig(): RedisSentinelConfig {
  const enabled = process.env.REDIS_SENTINEL_ENABLED === 'true';
  const nodesString = process.env.REDIS_SENTINEL_NODES || '';

  // Parse sentinel nodes from environment
  const sentinels: RedisClusterNode[] = nodesString
    .split(',')
    .filter(Boolean)
    .map((nodeStr) => {
      const [host, portStr] = nodeStr.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(portStr || '26379', 10),
      };
    });

  return {
    enabled,
    sentinels: sentinels.length > 0 ? sentinels : [{ host: 'localhost', port: 26379 }],
    name: process.env.REDIS_SENTINEL_MASTER || 'mymaster',
    options: {
      sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      enableTLSForSentinelMode: process.env.REDIS_SENTINEL_TLS === 'true',
      sentinelRetryStrategy: (times: number) => {
        if (times > 10) {
          console.error('[Redis Sentinel] Max retry attempts reached');
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        console.log(`[Redis Sentinel] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'CLUSTERDOWN', 'MOVED'];
        if (targetErrors.some((e) => err.message.includes(e))) {
          return 2;
        }
        return false;
      },
      failoverDetector: true,
    },
  };
}

/**
 * Get Redis connection pool configuration
 */
export function getRedisPoolConfig(): RedisPoolConfig {
  return {
    maxConnections: parseInt(process.env.REDIS_POOL_SIZE || '10', 10),
    minConnections: parseInt(process.env.REDIS_POOL_MIN || '2', 10),
    acquireTimeout: parseInt(process.env.REDIS_POOL_ACQUIRE_TIMEOUT || '10000', 10),
    idleTimeout: parseInt(process.env.REDIS_POOL_IDLE_TIMEOUT || '30000', 10),
    evictionRunInterval: parseInt(process.env.REDIS_POOL_EVICTION_INTERVAL || '60000', 10),
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

/**
 * Determine the best Redis mode based on configuration
 */
export function determineRedisMode(): 'cluster' | 'sentinel' | 'standalone' | 'upstash' | 'memory' {
  // Check if Redis is disabled
  if (process.env.DISABLE_REDIS === 'true') {
    return 'memory';
  }

  // Check for Upstash (serverless-first for Vercel)
  const upstashConfig = getUpstashConfig();
  if (upstashConfig?.url && upstashConfig?.token) {
    return 'upstash';
  }

  // Check for cluster mode
  const clusterConfig = getRedisClusterConfig();
  if (clusterConfig.enabled && clusterConfig.nodes.length > 0) {
    return 'cluster';
  }

  // Check for sentinel mode
  const sentinelConfig = getRedisSentinelConfig();
  if (sentinelConfig.enabled && sentinelConfig.sentinels.length > 0) {
    return 'sentinel';
  }

  // Default to standalone
  const redisConfig = getRedisConfig();
  if (redisConfig.url || redisConfig.host) {
    return 'standalone';
  }

  // Fallback to memory
  return 'memory';
}

/**
 * Get comprehensive Redis configuration summary
 */
export function getRedisConfigSummary(): {
  mode: string;
  config: Record<string, unknown>;
} {
  const mode = determineRedisMode();

  switch (mode) {
    case 'cluster':
      return {
        mode,
        config: {
          nodes: getRedisClusterConfig().nodes,
          scaleReads: getRedisClusterConfig().options.scaleReads,
          maxRedirections: getRedisClusterConfig().options.maxRedirections,
        },
      };
    case 'sentinel':
      return {
        mode,
        config: {
          sentinels: getRedisSentinelConfig().sentinels,
          masterName: getRedisSentinelConfig().name,
        },
      };
    case 'upstash':
      return {
        mode,
        config: {
          url: getUpstashConfig()?.url?.replace(/\/\/.*@/, '//***@'),
        },
      };
    case 'standalone':
      return {
        mode,
        config: {
          host: getRedisConfig().host,
          port: getRedisConfig().port,
          db: getRedisConfig().db,
        },
      };
    default:
      return {
        mode: 'memory',
        config: {
          maxItems: getCacheConfig().maxMemoryItems,
          ttl: getCacheConfig().defaultTTL,
        },
      };
  }
}

// Export default configuration getter
export default {
  getRedisConfig,
  getRedisClusterConfig,
  getRedisSentinelConfig,
  getRedisPoolConfig,
  getCacheConfig,
  getUpstashConfig,
  determineRedisMode,
  getRedisConfigSummary,
};
