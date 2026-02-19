/**
 * Prisma Client with Connection Pooling Configuration
 *
 * @task UNI-436 - Implement Database Connection Pooling
 * @task UNI-449 - Fix Supabase Pooler Compatibility
 *
 * IMPORTANT: This is the ONLY place PrismaClient should be instantiated.
 * All other files should import { prisma } from '@/lib/prisma'
 *
 * Connection pooling is handled via Supabase Supavisor on port 5432 (session mode).
 * Uses Prisma's built-in query engine (Rust) for SCRAM-SHA-256 auth instead of
 * node-postgres, which has SCRAM relay failures with Supavisor.
 *
 * ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Pooled connection via Supavisor (port 5432, session mode)
 * - DIRECT_URL: Direct PostgreSQL connection (port 5432) - CLI only
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

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
 * Create PrismaClient using Prisma's built-in query engine.
 *
 * Uses Prisma's Rust-based query engine for PostgreSQL connections instead of
 * node-postgres (@prisma/adapter-pg). The node-postgres SCRAM-SHA-256 client
 * implementation fails when Supavisor doesn't faithfully relay the server's
 * final signature in the SCRAM handshake. Prisma's built-in engine handles
 * SCRAM authentication independently and is not affected by this Supavisor bug.
 *
 * DATABASE_URL must include ?pgbouncer=true for Supavisor transaction mode,
 * or use session mode (port 5432) where prepared statements work natively.
 */
const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('[Prisma] DATABASE_URL is not set');
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Log connection target (without password)
  try {
    const url = new URL(connectionString);
    logger.info('Prisma connecting to database', {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      mode: 'prisma-engine',
    });
  } catch {
    // URL parsing failure is non-fatal for logging
  }

  const client = new PrismaClient({
    log: getLogConfig(),
    datasourceUrl: connectionString,
  });

  logger.info('Prisma client created with built-in query engine');

  // Set up event listeners for connection monitoring (dev only)
  if (process.env.NODE_ENV !== 'production') {
    client.$on('query' as never, (e: { duration: number; query: string }) => {
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
  // Skip during browser/client-side rendering
  if (typeof window !== 'undefined') {
    return null;
  }

  // Skip if DATABASE_URL is not configured (build time)
  if (!process.env.DATABASE_URL) {
    console.warn('[Prisma] DATABASE_URL not configured, skipping client creation');
    return null;
  }

  if (!globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma = createPrismaClient();
      logger.info('Prisma client initialized with built-in query engine');
    } catch (error) {
      console.error('[Prisma] Failed to create client:', error);
      return null;
    }
  }

  return globalForPrisma.prisma;
};

// Create singleton instance with proper null handling
const client = getPrismaClient();

if (!client && process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  throw new Error('[Prisma] Failed to initialize client - check DATABASE_URL configuration');
}

// Export prisma client (may be null during SSG/build without DATABASE_URL)
export const prisma = client as PrismaClient;

// Ensure singleton in development (hot reload protection)
if (process.env.NODE_ENV !== 'production' && client) {
  globalForPrisma.prisma = client;
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
    const errorMessage = error instanceof Error ? error.message : String(error);

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
    await prisma.$disconnect();
    globalForPrisma.prisma = null;
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
        lastError.message.includes('timeout') ||
        lastError.message.includes('SCRAM') ||
        lastError.message.includes('SASL') ||
        lastError.message.includes('password authentication');

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
