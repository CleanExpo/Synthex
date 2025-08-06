import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Determine if we're in a serverless environment
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Create Prisma Client with Accelerate for production/serverless
// or regular client for local development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ||
  (isServerless 
    ? new PrismaClient().$extends(withAccelerate())
    : new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      }));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export type for extended client
export type PrismaClientWithAccelerate = typeof prisma;