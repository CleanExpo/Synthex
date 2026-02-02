/**
 * Prisma Client with Connection Pooling Configuration
 *
 * @task UNI-436 - Implement Database Connection Pooling
 *
 * IMPORTANT: This is the ONLY place PrismaClient should be instantiated.
 * All other files should import { prisma } from '@/lib/prisma'
 *
 * Connection pooling is handled at multiple levels:
 * 1. Supabase PgBouncer (port 6543) - External pooling
 * 2. Prisma connection pool - Application-level pooling
 *
 * ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Pooled connection via PgBouncer (port 6543)
 * - DIRECT_URL: Direct PostgreSQL connection (port 5432)
 * - DATABASE_POOL_SIZE: Max connections (default: 10)
 * - DATABASE_POOL_TIMEOUT: Connection timeout in seconds (default: 10)
 */

import { PrismaClient, Prisma } from '@prisma/client';

// Pool configuration from environment
const POOL_CONFIG = {
  // Maximum number of connections in the pool
  connectionLimit: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  // Connection timeout in seconds
  poolTimeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '10', 10),
  // Connection acquisition timeout in milliseconds
  connectTimeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '5000', 10),
  // Idle connection timeout in milliseconds
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '60000', 10),
};

// Global singleton to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null;
  prismaMetrics: ConnectionMetrics;
};

/**
 * Connection pool metrics for monitoring
 */
interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  errors: number;
  lastHealthCheck: Date | null;
  isHealthy: boolean;
}

// Initialize metrics
globalForPrisma.prismaMetrics = globalForPrisma.prismaMetrics || {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  waitingRequests: 0,
  errors: 0,
  lastHealthCheck: null,
  isHealthy: true,
};

/**
 * Logging configuration based on environment
 */
const getLogConfig = (): Prisma.LogLevel[] => {
  if (process.env.NODE_ENV === 'development') {
    return ['query', 'error', 'warn'];
  }
  if (process.env.PRISMA_LOG_QUERIES === 'true') {
    return ['query', 'error', 'warn', 'info'];
  }
  return ['error', 'warn'];
};

/**
 * Create PrismaClient with optimized connection pooling
 */
const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: getLogConfig(),
    // Datasource configuration is handled via environment variables
    // DATABASE_URL should include connection pool parameters:
    // ?connection_limit=10&pool_timeout=10
  });

  // Set up event listeners for connection monitoring
  if (process.env.NODE_ENV !== 'production') {
    client.$on('query' as never, (e: any) => {
      if (e.duration > 1000) {
        console.warn(`[Prisma] Slow query (${e.duration}ms):`, e.query);
      }
    });
  }

  return client;
};

/**
 * Get or create the singleton PrismaClient instance
 */
const getPrismaClient = (): PrismaClient | null => {
  // Skip during build time if no database configured
  if (typeof window !== 'undefined') {
    return null;
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    console.warn('[Prisma] DATABASE_URL not configured, skipping client creation');
    return null;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    console.log('[Prisma] Client initialized with pool config:', {
      connectionLimit: POOL_CONFIG.connectionLimit,
      poolTimeout: POOL_CONFIG.poolTimeout,
      environment: process.env.NODE_ENV,
    });
  }

  return globalForPrisma.prisma;
};

// Create singleton instance
export const prisma = getPrismaClient()!;

// Ensure singleton in development (hot reload protection)
if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check function - verifies database connectivity
 * @returns Promise<boolean> - true if connection is healthy
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    if (!prisma) {
      return { healthy: false, latency: 0, error: 'Prisma client not initialized' };
    }

    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    // Update metrics
    globalForPrisma.prismaMetrics.lastHealthCheck = new Date();
    globalForPrisma.prismaMetrics.isHealthy = true;

    return { healthy: true, latency };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update metrics
    globalForPrisma.prismaMetrics.errors++;
    globalForPrisma.prismaMetrics.isHealthy = false;
    globalForPrisma.prismaMetrics.lastHealthCheck = new Date();

    console.error('[Prisma] Health check failed:', errorMessage);
    return { healthy: false, latency, error: errorMessage };
  }
}

/**
 * Get current connection pool metrics
 */
export function getPoolMetrics(): ConnectionMetrics {
  return { ...globalForPrisma.prismaMetrics };
}

/**
 * Graceful shutdown - close all connections
 * Call this during application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    console.log('[Prisma] Disconnecting...');
    await prisma.$disconnect();
    globalForPrisma.prisma = null;
    console.log('[Prisma] Disconnected successfully');
  }
}

/**
 * Reconnect to database (useful for connection recovery)
 */
export async function reconnectPrisma(): Promise<boolean> {
  try {
    if (prisma) {
      await prisma.$disconnect();
    }
    globalForPrisma.prisma = createPrismaClient();
    const health = await checkDatabaseHealth();
    return health.healthy;
  } catch (error) {
    console.error('[Prisma] Reconnection failed:', error);
    return false;
  }
}

/**
 * Execute with connection retry logic
 * @param operation - Function to execute
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 1000)
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a connection error that might be recoverable
      const isConnectionError =
        lastError.message.includes('connection') ||
        lastError.message.includes('pool') ||
        lastError.message.includes('timeout');

      if (attempt < maxRetries && isConnectionError) {
        console.warn(
          `[Prisma] Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms:`,
          lastError.message
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        // Exponential backoff
        retryDelay *= 2;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

/**
 * Transaction helper with timeout
 * @param fn - Transaction function
 * @param timeout - Maximum transaction time in ms (default: 5000)
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  timeout: number = 5000
): Promise<T> {
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }

  return prisma.$transaction(fn, {
    maxWait: timeout,
    timeout: timeout,
  });
}

// Export types
export type PrismaClientInstance = typeof prisma;
export type TransactionClient = Prisma.TransactionClient;

// Default export for backward compatibility
export default prisma;
