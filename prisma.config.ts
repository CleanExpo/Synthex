import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

// Prisma 7 does not auto-load .env files when prisma.config.ts is present — load them manually.
//
// Load order:
//   1. .env.local — user-specific overrides (highest priority; already in process.env via dotenvx)
//   2. .env       — base config that fills gaps (e.g. DIRECT_URL not in .env.local)
// dotenv's default behaviour: does NOT override vars already set, so .env.local always wins.
//
// On Vercel, env vars are already in process.env — loadEnv is a no-op (files don't exist).
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // DIRECT_URL bypasses pgBouncer for DDL/migrations (Supabase port 5432).
    // Falls back to DATABASE_URL (pgBouncer pool) if DIRECT_URL is not set.
    // Uses process.env directly so Vercel-injected vars are always resolved.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
