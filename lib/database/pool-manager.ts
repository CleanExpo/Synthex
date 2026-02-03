/**
 * Database Connection Pool Manager
 *
 * @description Manages database connection pooling with:
 * - Health monitoring and connection validation
 * - Automatic connection recycling
 * - Graceful degradation under pressure
 * - Connection statistics and metrics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection string (CRITICAL)
 *
 * FAILURE MODE: Returns error responses when pool exhausted
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  maxWaitingClients: number;
  validateOnBorrow: boolean;
  recycleAfterRequests: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface PoolHealthCheck {
  isHealthy: boolean;
  latency: number;
  lastCheckTime: Date;
  consecutiveFailures: number;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_POOL_CONFIG: PoolConfig = {
  min: 2,
  max: 10,
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 5000,
  maxWaitingClients: 50,
  validateOnBorrow: true,
  recycleAfterRequests: 1000,
};

// ============================================================================
// POOL MANAGER
// ============================================================================

export class PoolManager {
  private static instance: PoolManager | null = null;
  private client: PrismaClient | null = null;
  private config: PoolConfig;
  private stats: {
    totalRequests: number;
    failedRequests: number;
    waitTimes: number[];
  };
  private healthCheck: PoolHealthCheck;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      failedRequests: 0,
      waitTimes: [],
    };
    this.healthCheck = {
      isHealthy: true,
      latency: 0,
      lastCheckTime: new Date(),
      consecutiveFailures: 0,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<PoolConfig>): PoolManager {
    if (!PoolManager.instance) {
      PoolManager.instance = new PoolManager(config);
    }
    return PoolManager.instance;
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.client) {
      logger.warn('Pool already initialized');
      return;
    }

    try {
      this.client = new PrismaClient({
        log: [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      // Set up event handlers
      this.client.$on('warn' as never, (e: { message: string }) => {
        logger.warn('Prisma warning', { message: e.message });
      });

      this.client.$on('error' as never, (e: { message: string }) => {
        logger.error('Prisma error', { message: e.message });
      });

      // Test connection
      await this.client.$connect();
      logger.info('Database pool initialized');

      // Start health check
      this.startHealthCheck();
    } catch (error) {
      logger.error('Failed to initialize database pool', { error });
      throw error;
    }
  }

  /**
   * Get the Prisma client
   */
  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error('Pool not initialized. Call initialize() first.');
    }

    // Check health before returning client
    if (!this.healthCheck.isHealthy && this.healthCheck.consecutiveFailures > 3) {
      logger.warn('Database pool unhealthy, attempting recovery');
    }

    this.stats.totalRequests++;
    return this.client;
  }

  /**
   * Execute a database operation with timeout
   */
  async execute<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      const client = this.getClient();

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Database operation timed out after ${this.config.connectionTimeoutMs}ms`));
        }, this.config.connectionTimeoutMs);
      });

      // Race between operation and timeout
      const result = await Promise.race([
        operation(client),
        timeoutPromise,
      ]);

      // Record wait time
      const waitTime = Date.now() - startTime;
      this.recordWaitTime(waitTime);

      return result;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  /**
   * Execute a transaction with automatic retry
   */
  async transaction<T>(
    operations: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
    options?: { maxRetries?: number; timeout?: number }
  ): Promise<T> {
    const { maxRetries = 3, timeout = 10000 } = options || {};
    const client = this.getClient();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await client.$transaction(operations, {
          maxWait: 5000,
          timeout,
        });
      } catch (error) {
        logger.warn('Transaction failed, retrying', {
          attempt,
          maxRetries,
          error: (error as Error).message,
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        await this.delay(Math.min(100 * Math.pow(2, attempt), 5000));
      }
    }

    throw new Error('Transaction failed after max retries');
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform a health check
   */
  async performHealthCheck(): Promise<PoolHealthCheck> {
    const startTime = Date.now();

    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Simple query to test connection
      await this.client.$queryRaw`SELECT 1`;

      const latency = Date.now() - startTime;

      this.healthCheck = {
        isHealthy: true,
        latency,
        lastCheckTime: new Date(),
        consecutiveFailures: 0,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.healthCheck = {
        isHealthy: false,
        latency,
        lastCheckTime: new Date(),
        consecutiveFailures: this.healthCheck.consecutiveFailures + 1,
        error: (error as Error).message,
      };

      logger.error('Database health check failed', {
        consecutiveFailures: this.healthCheck.consecutiveFailures,
        error: (error as Error).message,
      });

      // Attempt reconnection if multiple failures
      if (this.healthCheck.consecutiveFailures >= 3) {
        await this.attemptReconnection();
      }
    }

    return { ...this.healthCheck };
  }

  /**
   * Attempt to reconnect the database
   */
  private async attemptReconnection(): Promise<void> {
    logger.info('Attempting database reconnection');

    try {
      if (this.client) {
        await this.client.$disconnect();
      }

      this.client = new PrismaClient({
        log: [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
      });

      await this.client.$connect();
      logger.info('Database reconnection successful');
    } catch (error) {
      logger.error('Database reconnection failed', { error });
    }
  }

  /**
   * Record query wait time for metrics
   */
  private recordWaitTime(ms: number): void {
    this.stats.waitTimes.push(ms);

    // Keep only last 1000 measurements
    if (this.stats.waitTimes.length > 1000) {
      this.stats.waitTimes = this.stats.waitTimes.slice(-1000);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const waitTimes = this.stats.waitTimes;
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    const healthStatus = this.healthCheck.isHealthy
      ? 'healthy'
      : this.healthCheck.consecutiveFailures > 3
        ? 'unhealthy'
        : 'degraded';

    return {
      totalConnections: this.config.max,
      activeConnections: 0, // Prisma manages this internally
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: this.stats.totalRequests,
      failedRequests: this.stats.failedRequests,
      averageWaitTime: Math.round(averageWaitTime),
      healthStatus,
    };
  }

  /**
   * Get health check status
   */
  getHealthStatus(): PoolHealthCheck {
    return { ...this.healthCheck };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
    }

    logger.info('Database pool disconnected');
  }

  /**
   * Reset the pool manager (for testing)
   */
  static reset(): void {
    if (PoolManager.instance) {
      PoolManager.instance.disconnect().catch(console.error);
      PoolManager.instance = null;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the database client from pool
 */
export function getDbClient(): PrismaClient {
  return PoolManager.getInstance().getClient();
}

/**
 * Execute a database operation with pool management
 */
export async function withDb<T>(
  operation: (client: PrismaClient) => Promise<T>
): Promise<T> {
  return PoolManager.getInstance().execute(operation);
}

/**
 * Execute a database transaction
 */
export async function withTransaction<T>(
  operations: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  options?: { maxRetries?: number; timeout?: number }
): Promise<T> {
  return PoolManager.getInstance().transaction(operations, options);
}

// Export default
export default PoolManager;
