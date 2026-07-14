/**
 * Database access layer — single import surface for Prisma.
 *
 * `@/lib/prisma` remains the implementation; this barrel provides a stable
 * domain-oriented entry point for new code (`import { prisma } from '@/lib/db'`).
 *
 * Do not instantiate PrismaClient anywhere else.
 */

export {
  prisma,
  default,
  checkDatabaseHealth,
  disconnectPrisma,
  executeWithRetry,
  getPoolMetrics,
  reconnectPrisma,
  withTransaction,
} from '@/lib/prisma';

export type { PrismaClientInstance, TransactionClient } from '@/lib/prisma';
