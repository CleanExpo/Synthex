/**
 * Unified Database Connection Service
 * Provides connection pooling and database utilities for all services
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import Redis from 'ioredis';

// Database configuration from environment
const dbConfig = {
  host: process.env.DB_HOST || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0] + '.supabase.co' || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : undefined
};

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
};

/**
 * Database connection pool singleton
 */
class Database {
  private static instance: Database;
  private pool: Pool | null = null;
  private redis: Redis | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  /**
   * Get database instance
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Initialize PostgreSQL pool
      this.pool = new Pool(dbConfig);
      
      // Test PostgreSQL connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ PostgreSQL connection established');

      // Initialize Redis connection
      this.redis = new Redis(redisConfig);
      
      // Test Redis connection
      await this.redis.ping();
      console.log('✅ Redis connection established');

      this.isConnected = true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw error - allow app to run with degraded functionality
      this.isConnected = false;
    }
  }

  /**
   * Get PostgreSQL pool
   */
  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Get Redis client
   */
  public getRedis(): Redis | null {
    return this.redis;
  }

  /**
   * Execute a query with automatic connection handling
   */
  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    return pool.query<T>(text, params);
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cache operations with Redis fallback to memory
   */
  private memoryCache = new Map<string, { value: any; expiry: number }>();

  public async cache(
    key: string,
    value: any,
    ttl: number = 300 // Default 5 minutes
  ): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify(value));
        return;
      } catch (error) {
        console.warn('Redis cache set failed, falling back to memory:', error);
      }
    }
    
    // Fallback to memory cache
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
  }

  public async getCached<T = any>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn('Redis cache get failed, falling back to memory:', error);
      }
    }
    
    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    // Clean up expired entry
    if (cached) {
      this.memoryCache.delete(key);
    }
    
    return null;
  }

  public async invalidateCache(pattern: string): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch (error) {
        console.warn('Redis cache invalidation failed:', error);
      }
    }
    
    // Fallback to memory cache
    for (const [key] of this.memoryCache) {
      if (key.includes(pattern.replace('*', ''))) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    postgres: boolean;
    redis: boolean;
    poolStats?: {
      total: number;
      idle: number;
      waiting: number;
    };
  }> {
    const result = {
      postgres: false,
      redis: false,
      poolStats: undefined as any
    };

    // Check PostgreSQL
    if (this.pool) {
      try {
        await this.pool.query('SELECT 1');
        result.postgres = true;
        result.poolStats = {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        };
      } catch (error) {
        console.error('PostgreSQL health check failed:', error);
      }
    }

    // Check Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        result.redis = true;
      } catch (error) {
        console.error('Redis health check failed:', error);
      }
    }

    return result;
  }

  /**
   * Cleanup connections
   */
  public async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
    
    this.memoryCache.clear();
    this.isConnected = false;
    console.log('✅ Database connections closed');
  }
}

// Export singleton instance
export const db = Database.getInstance();

// Export types for convenience
export type { Pool, PoolClient, QueryResult } from 'pg';
export type { Redis } from 'ioredis';

// Utility functions for common database operations
export const DatabaseUtils = {
  /**
   * Format date for PostgreSQL
   */
  formatDate(date: Date): string {
    return date.toISOString();
  },

  /**
   * Build dynamic WHERE clause
   */
  buildWhereClause(filters: Record<string, any>): {
    text: string;
    values: any[];
  } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          conditions.push(`${key} = ANY($${paramIndex})`);
          values.push(value);
        } else if (typeof value === 'object' && value.min && value.max) {
          conditions.push(`${key} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          values.push(value.min, value.max);
          paramIndex++;
        } else {
          conditions.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    return {
      text: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    };
  },

  /**
   * Build pagination clause
   */
  buildPaginationClause(page: number = 1, limit: number = 10): {
    text: string;
    offset: number;
  } {
    const offset = (page - 1) * limit;
    return {
      text: `LIMIT ${limit} OFFSET ${offset}`,
      offset
    };
  },

  /**
   * Build ORDER BY clause
   */
  buildOrderByClause(
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): string {
    return `ORDER BY ${sortBy} ${sortOrder}`;
  }
};

// Initialize database on module load
if (process.env.NODE_ENV !== 'test') {
  db.initialize().catch(console.error);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.cleanup();
  process.exit(0);
});

export default db;
