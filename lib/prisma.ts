import { PrismaClient } from '@prisma/client';

// Create Prisma Client with build-time safety
// Prevents enableTracing error during static generation
const globalForPrisma = global as unknown as { prisma: PrismaClient };

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

export type PrismaClientWithAccelerate = typeof prisma;

export default prisma;