/**
 * Prisma Client with Connection Pooling Configuration
 *
 * @task UNI-436 - Implement Database Connection Pooling
 * @task UNI-449 - Fix Supabase Pooler Compatibility
 *
 * IMPORTANT: This is the ONLY place PrismaClient should be instantiated.
 * All other files should import { prisma } from '@/lib/prisma'
 *
 * Connection pooling is handled via:
 * 1. Supabase Supavisor on port 6543 (transaction mode)
 * 2. @prisma/adapter-pg for PostgreSQL wire protocol compatibility
 * 3. pg-scram-patch to work around Supavisor SCRAM relay bug
 *
 * ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Pooled connection via Supavisor (port 6543)
 *   Must include ?pgbouncer=true parameter
 * - DIRECT_URL: Direct PostgreSQL connection (port 5432) - CLI only
 */

import { patchPgScram } from '@/lib/pg-scram-patch';

// MUST run before any pg.Pool is created
patchPgScram();

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
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
 * Create PrismaClient with PrismaPg adapter for Supabase pooler compatibility.
 *
 * Uses explicit Pool config (NOT connectionString) to control SSL settings.
 * The pg-scram-patch module suppresses Supavisor's SCRAM relay failures.
 */
const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('[Prisma] DATABASE_URL is not set');
    throw new Error('DATABASE_URL environment variable is required');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch (parseError) {
    console.error('[Prisma] Failed to parse DATABASE_URL:', parseError);
    throw new Error('Invalid DATABASE_URL format');
  }

  const host = url.hostname;
  const port = parseInt(url.port || '5432', 10);
  const database = url.pathname.replace(/^\//, '');
  const user = url.username;
  const password = decodeURIComponent(url.password);

  logger.info('Prisma connecting to database', { host, port, database, mode: 'adapter-pg + scram-patch' });

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[Prisma] Pool error:', err.message);
    globalForPrisma.prismaMetrics.errors++;
  });

  // PrismaPg adapter type doesn't perfectly match SqlDriverAdapterFactory in Prisma 6 — safe to cast
  const adapter: any = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: getLogConfig(),
  });

  logger.info('Prisma client created with PrismaPg adapter + SCRAM patch');

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
  if (typeof window !== 'undefined') {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    console.warn('[Prisma] DATABASE_URL not configured, skipping client creation');
    return null;
  }

  if (!globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma = createPrismaClient();
      logger.info('Prisma client initialized');
    } catch (error) {
      console.error('[Prisma] Failed to create client:', error);
      return null;
    }
  }

  return globalForPrisma.prisma;
};

// Lazy initialization — deferred until the first property access.
//
// WHY: Calling getPrismaClient() at module load time caused a 10 s Lambda cold-start
// hang. Every Lambda route loads the shared webpack bundle (which contains lib/prisma.ts)
// before its handler runs. new PrismaPg(pool) / new PrismaClient({ adapter }) initiates
// a database connection during bundle-load, blocking for the full connectionTimeoutMillis
// (10 000 ms) on cold start — even on routes like /api/health/live that never touch the DB.
//
// The Proxy forwards all accesses (prisma.user, prisma.$queryRaw, etc.) to the real
// PrismaClient, initialising it only on the first actual query — not at bundle-load time.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = getPrismaClient();
    if (!c) {
      if (prop === 'then') return undefined; // Prevent unintended Promise treatment
      throw new Error(
        `[Prisma] Client not initialized (accessed: ${String(prop)}). ` +
          `DATABASE_URL may not be set or client creation failed.`
      );
    }
    const val = (c as any)[prop];
    return typeof val === 'function' ? val.bind(c) : val;
  },
});

/**
 * Health check function - verifies database connectivity
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const c = getPrismaClient();
    if (!c) {
      return { healthy: false, latency: 0, error: 'Prisma client not initialized' };
    }

    await c.$queryRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    globalForPrisma.prismaMetrics.lastHealthCheck = new Date();
    globalForPrisma.prismaMetrics.isHealthy = true;

    return { healthy: true, latency };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

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
 */
export async function disconnectPrisma(): Promise<void> {
  const c = getPrismaClient();
  if (c) {
    await c.$disconnect();
    globalForPrisma.prisma = null;
  }
}

/**
 * Reconnect to database (useful for connection recovery)
 */
export async function reconnectPrisma(): Promise<boolean> {
  try {
    const c = getPrismaClient();
    if (c) {
      await c.$disconnect();
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
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  timeout: number = 5000
): Promise<T> {
  const c = getPrismaClient();
  if (!c) {
    throw new Error('Prisma client not initialized');
  }

  return c.$transaction(fn, {
    maxWait: timeout,
    timeout: timeout,
  });
}

// Export types
export type PrismaClientInstance = typeof prisma;
export type TransactionClient = Prisma.TransactionClient;

// Default export for backward compatibility
export default prisma;
