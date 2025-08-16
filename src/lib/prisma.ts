import { PrismaClient } from '@prisma/client';

// Create Prisma Client
// Using regular client for both development and production
// Note: Accelerate extension can be added later if needed
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Only initialize Prisma if we're not in build time
// This prevents the enableTracing error during static generation
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma || (
  typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL
    ? null as any // Return null during build time if no DATABASE_URL
    : createPrismaClient()
);

if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma;
}

// Export type for client
export type PrismaClientWithAccelerate = typeof prisma;
