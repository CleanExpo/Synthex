/**
 * Cache Factory
 * Automatically selects the appropriate cache service based on environment
 */

import { ICacheService, ILogger } from '../../architecture/layer-interfaces';
import { CacheService } from './cache.service';
import { UpstashCacheService } from './upstash-cache.service';
import { getRedisConfig, getUpstashConfig, getCacheConfig } from '../../config/redis.config';

export class CacheFactory {
  /**
   * Create cache service based on environment
   */
  static createCacheService(logger: ILogger): ICacheService {
    const cacheConfig = getCacheConfig();
    
    // Check if Redis is disabled
    if (!cacheConfig.enableRedis) {
      logger.info('Redis disabled, using in-memory cache only');
      return new CacheService(logger);
    }
    
    // Check for Upstash configuration (preferred for Vercel)
    const upstashConfig = getUpstashConfig();
    if (upstashConfig && upstashConfig.url && upstashConfig.token) {
      logger.info('Using Upstash Redis for caching (serverless optimized)');
      return new UpstashCacheService(
        logger,
        upstashConfig.url,
        upstashConfig.token
      );
    }
    
    // Check for standard Redis configuration
    const redisConfig = getRedisConfig();
    if (redisConfig.url || redisConfig.host) {
      logger.info('Using standard Redis for caching');
      const connectionString = redisConfig.url || 
        `redis://${redisConfig.password ? `:${redisConfig.password}@` : ''}${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;
      
      return new CacheService(logger, connectionString);
    }
    
    // Fallback to in-memory cache
    logger.warn('No Redis configuration found, using in-memory cache only');
    return new CacheService(logger);
  }
  
  /**
   * Create cache service with custom configuration
   */
  static createCustomCacheService(
    logger: ILogger,
    config: {
      type: 'redis' | 'upstash' | 'memory';
      connectionString?: string;
      upstashUrl?: string;
      upstashToken?: string;
    }
  ): ICacheService {
    switch (config.type) {
      case 'upstash':
        if (!config.upstashUrl || !config.upstashToken) {
          throw new Error('Upstash URL and token are required for Upstash cache');
        }
        return new UpstashCacheService(logger, config.upstashUrl, config.upstashToken);
        
      case 'redis':
        if (!config.connectionString) {
          throw new Error('Connection string is required for Redis cache');
        }
        return new CacheService(logger, config.connectionString);
        
      case 'memory':
      default:
        return new CacheService(logger);
    }
  }
}