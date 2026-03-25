import { defineConfig, env } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

// Prisma 7 does not auto-load .env files when prisma.config.ts is present — load them manually.
//
// Load order:
//   1. .env.local — user-specific overrides (highest priority; already in process.env via dotenvx)
//   2. .env       — base config that fills gaps (e.g. DIRECT_URL not in .env.local)
// dotenv's default behaviour: does NOT override vars already set, so .env.local always wins.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' }); // fills DIRECT_URL and any other vars absent from .env.local

type Env = {
  DATABASE_URL: string;
  DIRECT_URL: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Used by CLI commands (migrate diff, validate, studio, etc.)
    // DIRECT_URL is used when available (bypasses pgBouncer for DDL/migrations)
    // The runtime connection is handled by the PrismaPg adapter in lib/prisma.ts
    url: env<Env>('DIRECT_URL') || env<Env>('DATABASE_URL'),
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
