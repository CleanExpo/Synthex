import { PrismaClient } from '@prisma/client';

// Create Prisma Client
// Using regular client for both development and production
// Note: Accelerate extension can be added later if needed
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export type for client
export type PrismaClientWithAccelerate = typeof prisma;
